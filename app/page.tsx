// File: app/chat/page.tsx
'use client';

import {
  Box, Button, Input, useToast, Spinner, Flex, Text, Avatar, Select,
  AlertDialog, AlertDialogOverlay, AlertDialogContent,
  AlertDialogHeader, AlertDialogBody, AlertDialogFooter
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSolidSession } from '@/contexts/SolidSessionContext';
import { createParser } from 'eventsource-parser';
import {
  getSolidDataset, getThingAll, getStringNoLocale,
  saveSolidDatasetAt, setThing, createThing, buildThing,
  setStringNoLocale, createSolidDataset, getPodUrlAll,
  createContainerAt, getResourceInfo, getContainedResourceUrlAll
} from '@inrupt/solid-client';
import { RDF, SCHEMA_INRUPT, DCTERMS } from '@inrupt/vocab-common-rdf';
import { v4 as uuidv4 } from 'uuid';
import { asUrl } from '@inrupt/solid-client';
import { useChatSession } from '@/contexts/ChatSessionContext';
const SCHEMA_ABOUT = 'http://schema.org/about';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [inputMessage, setInputMessage] = useState('');
const {
  sessionMessages, setSessionMessages,
  sessionsList, setSessionsList,
  currentSession, setCurrentSession,
  selectedAgent, setSelectedAgent,
  allMessages, setAllMessages
} = useChatSession();

  const [loading, setLoading] = useState(false);
  const { solidPermissionGranted, setSolidPermissionGranted } = useChatSession();

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showLLMDialog, setShowLLMDialog] = useState(true); // akan muncul saat load pertama
 const { selectedLLM, setSelectedLLM } = useChatSession();
 
  const cancelRef = useRef(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const toast = useToast();
  const { session, isLoggedIn, loading: authLoading } = useSolidSession();

  const getModelFromProvider = (provider: string): string => {
    const modelMap: Record<string, string> = {
      openai: 'openai/gpt-4o',
      deepseek: 'deepseek/deepseek-chat',
      llama: 'meta-llama/llama-3.3-70b-instruct',
      llama33: 'meta-llama/llama-3.3-70b-instruct',
      kimi: 'moonshotai/kimi-k2',
      qwen: 'qwen/qwen-2.5-72b-instruct',
      gemini: 'google/gemini-2.5-flash',
    };

    return modelMap[provider] || 'google/gemini-2.5-flash';
  };
  const model = getModelFromProvider(selectedLLM);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace('/sign-in');
    }
  }, [isLoggedIn, authLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

  useEffect(() => {
  if (isLoggedIn && session?.info?.webId) {
    (async () => {
      try {
        // 🔑 Ambil Pod URL dari WebID
        let podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });

        // fallback kalau user profile tidak punya solid:storage
        if (!podUrls.length) {
          const fallback = session.info.webId!.replace('/profile/card#me', '/');
          podUrls = [fallback];
          console.warn('⚠️ No solid:storage found, using fallback:', fallback);
        }

        const storage = podUrls[0];
        await ensureChatFolderExists(storage);
        await loadChatSessions(storage);

        toast({
          title: '✅ Connected to Solid Pod',
          description: `Storage URL: ${storage}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } catch (err) {
        console.error('❌ Failed to get Pod URL:', err);
        toast({
          title: '❌ Failed to connect to Solid Pod',
          description: 'Could not resolve storage root from your WebID.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    })();
  }
}, [isLoggedIn, session]);

// ✅ Pastikan folder untuk chat ada
const ensureChatFolderExists = async (storageRoot: string) => {
  const chatFolderUrl = `${storageRoot}public/llm-solid-chat/`;

  try {
    // cek apakah folder sudah ada
    await getResourceInfo(chatFolderUrl, { fetch: session.fetch });
    console.log('📁 Chat folder already exists:', chatFolderUrl);
  } catch {
    try {
      // paksa buat container secara eksplisit
      await session.fetch(chatFolderUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "text/turtle",
          "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          "Slug": "llm-solid-chat"
        },
        body: ""
      });
      console.log("📁 Chat folder created via PUT:", chatFolderUrl);
    } catch (err) {
      console.error("❌ Failed to create chat folder:", err);
    }
  }
};

// ✅ Load daftar sesi chat dari Pod
const loadChatSessions = async (storageRoot: string) => {
  try {
    const folder = `${storageRoot}public/llm-solid-chat/`;
    const containerDataset = await getSolidDataset(folder, { fetch: session.fetch });
    const things = getThingAll(containerDataset);
    const files = things.map((t) => asUrl(t));

    const sessions = files
      .map((url) => url.split('/').pop() || '')
      .filter((name) => name.endsWith('.ttl'));

    setSessionsList(sessions);

    if (sessions.length) {
      setCurrentSession(sessions[0]);
      await loadMessagesFromSolidPod(sessions[0]); // pastikan pakai session.fetch
    }
  } catch (err) {
    console.warn('⚠️ Could not load sessions:', err);
  }
};

const newSession = async () => {
  const name = `session-${uuidv4()}.ttl`;
  const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
  const folder = `${podUrls[0]}public/llm-solid-chat/`;
  const newUrl = `${folder}${name}`;
  await saveSolidDatasetAt(newUrl, createSolidDataset(), { fetch: session.fetch });

  setSessionsList((prev) => [name, ...prev]); // ✅ setelah context diperbaiki
  setCurrentSession(name);
  setSessionMessages([]);
  setAllMessages([]);
};

const loadMessagesFromSolidPod = async (filename: string) => {
  try {
    const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
    const chatFileUrl = `${podUrls[0]}public/llm-solid-chat/${filename}`;

    const dataset = await getSolidDataset(chatFileUrl, { fetch: session.fetch });
    const things = getThingAll(dataset);

    const parsedMessages = things.map((thing) => {
      const content = getStringNoLocale(thing, SCHEMA_INRUPT.text);
      const role = getStringNoLocale(thing, SCHEMA_ABOUT) as 'user' | 'assistant';
      const id = getStringNoLocale(thing, DCTERMS.identifier);
      const created = getStringNoLocale(thing, DCTERMS.created);

      const chatWith = getStringNoLocale(thing, 'https://schema.org/chatWith');
      const modelVersion = getStringNoLocale(thing, 'https://schema.org/modelVersion');
      const sessionPairId = getStringNoLocale(thing, 'https://schema.org/sessionPairId');

      if (content && role && id && created) {
        return {
          id,
          role,
          content,
          created: new Date(created).getTime(),
          chatWith,
          modelVersion,
          sessionPairId,
        };
      }
    }).filter(Boolean) as (Message & {
      created: number;
      chatWith?: string;
      modelVersion?: string;
      sessionPairId?: string;
    })[];

    parsedMessages.sort((a, b) => a.created - b.created);
    const messages = parsedMessages.map(({ id, role, content }) => ({
  id: id ?? uuidv4(), // fallback jika id undefined
  role,
  content,
}));

    setAllMessages(messages);
    setSessionMessages(messages);
    await sendContextToLLM(messages);
  } catch (err) {
    console.warn('⚠️ Could not load messages from Solid Pod:', err);
  }
};
const sendContextToLLM = async (messages: Message[]) => {
  const agentPrompt = (() => {
    switch (selectedAgent) {
      case 'math':
        return 'You are a calculator. Answer with numeric logic only.';
      default:
        return 'You are a helpful assistant.';
    }
  })();

  const contextMessages = [
    { role: 'system', content: agentPrompt },
    ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
  ];

  try {
    const res = await fetch('/api/chatAPI', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: contextMessages,
        model,
        stream: false,
        provider: selectedLLM,
      }),
    });

    if (!res.ok) throw new Error(`Failed to send context to LLM. Status: ${res.status}`);
  } catch (err) {
    console.warn('❗ Gagal mengirim context ke LLM:', err);
  }
};

function isMathExpression(input: string): boolean {
  return /^[0-9\s\+\-\*\/\.\(\)]+$/.test(input.trim());
}

// Prompt default (non-math)
function getAgentPrompt(agent: string): string {
  switch (agent) {
    case 'weather':
      return 'You are a weather forecaster. Only provide weather updates.';
    case 'animal':
      return 'You are a zoologist. Only talk about animals.';
    default:
      return 'You are a helpful assistant.';
  }
}

// Membuat daftar pesan kontekstual untuk LLM
function getContextMessages(agent: string, messages: Message[]): any[] {
  if (agent === 'math') {
    return messages.map((msg) => ({ role: msg.role, content: msg.content }));
  }
  return [
    { role: 'system', content: getAgentPrompt(agent) },
    ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
  ];
}
const handleSendMessage = async () => {
  if (!inputMessage.trim() || !currentSession) {
    toast({ title: 'Error', description: 'Please enter a message or select session.', status: 'error', duration: 3000, isClosable: true });
    return;
  }

  const userMessage: Message = { id: uuidv4(), role: 'user', content: inputMessage };


  let agentPrompt = '';
  switch (selectedAgent) {
    case 'math': agentPrompt = 'You are a calculator. Answer with numeric logic only.'; break;
    default: agentPrompt = 'You are a helpful assistant.';
  }
const isMathMCP = selectedAgent === 'math' && isMathExpression(inputMessage);

const fullMessages = isMathMCP
    ? [
        ...sessionMessages.map(({ role, content }) => ({ role, content })),
        { role: 'user', content: inputMessage },
      ]
    : [
        { role: 'system', content: getAgentPrompt(selectedAgent) },
        ...sessionMessages.map(({ role, content }) => ({ role, content })),
        { role: 'user', content: inputMessage },
      ];

  setSessionMessages([
  ...sessionMessages,
  {
    id: userMessage.id || uuidv4(), // fallback kalau `id` bisa undefined
    role: userMessage.role,
    content: userMessage.content,
  },
]);
  setInputMessage('');

  if (session && isLoggedIn && solidPermissionGranted) {
    await saveMessageToSolidPod(userMessage, {
      chatWith: selectedAgent,
      modelVersion: model,
      sessionPairId: currentSession,
    });
  }

  setLoading(true);

  try {
    const res = await fetch('/api/chatAPI', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: fullMessages,
        stream: true,
        model,
        provider: selectedLLM,
      }),
    });

    if (!res.ok || !res.body) throw new Error(`HTTP error! status: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let assistantMessageContent = '';
    const assistantId = uuidv4();

    setSessionMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    const parser = createParser((event) => {
      if (event.type === 'event' && event.data !== '[DONE]') {
        try {
          const parsed = JSON.parse(event.data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            assistantMessageContent += content;

            setSessionMessages((prev) => {
              const updated = [...prev];
              const last = updated.find((msg) => msg.id === assistantId);
              if (last) last.content += content;
              return [...updated];
            });

            if (solidPermissionGranted === null) setShowPermissionDialog(true);
          }
        } catch (e) {
          console.error('Parser error:', e);
        }
      }
    });

    while (!done) {
      const { value, done: isDone } = await reader.read();
      if (value) parser.feed(decoder.decode(value));
      done = isDone;
    }

    if (session && isLoggedIn && solidPermissionGranted) {
      await saveMessageToSolidPod(
        { id: assistantId, role: 'assistant', content: assistantMessageContent },
        {
          chatWith: selectedAgent,
          modelVersion: model,
          sessionPairId: currentSession,
        }
      );
    }

   toast({
  title: 'Success',
  description: `Received response from ${
    selectedLLM === 'openai' ? 'ChatGPT' :
    selectedLLM === 'deepseek' ? 'DeepSeek' :
    selectedLLM === 'llama' || selectedLLM === 'llama33' ? 'LLaMA 3.3' :
    selectedLLM === 'kimi' ? 'Kimi' :
    selectedLLM === 'qwen' ? 'Qwen' :
    selectedLLM === 'gemini' ? 'Gemini' : 'LLM'
  }.`,
  status: 'success',
  duration: 3000,
  isClosable: true,
});

  } catch (err: any) {
    console.error('Error during fetch:', err);
    setSessionMessages((prev) => prev.slice(0, -1));

  } finally {
    setLoading(false);
  }
};

const saveMessageToSolidPod = async (
  msg: Message,
  metadata?: { chatWith?: string; modelVersion?: string; sessionPairId?: string }
) => {
  try {
    const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
    const chatFileUrl = `${podUrls[0]}public/llm-solid-chat/${currentSession}`;

    let dataset;
    try {
      dataset = await getSolidDataset(chatFileUrl, { fetch: session.fetch });
    } catch {
      dataset = createSolidDataset();
    }

    let newThingBuilder = buildThing(createThing())
      .addStringNoLocale(SCHEMA_INRUPT.text, msg.content)
      .addStringNoLocale(DCTERMS.created, new Date().toISOString())
      .addStringNoLocale(SCHEMA_ABOUT, msg.role)
      .addStringNoLocale(DCTERMS.identifier, msg.id! || uuidv4());

    if (metadata?.chatWith) {
      newThingBuilder = newThingBuilder.addStringNoLocale('https://schema.org/chatWith', metadata.chatWith);
    }
    if (metadata?.modelVersion) {
      newThingBuilder = newThingBuilder.addStringNoLocale('https://schema.org/modelVersion', metadata.modelVersion);
    }
    if (metadata?.sessionPairId) {
      newThingBuilder = newThingBuilder.addStringNoLocale('https://schema.org/sessionPairId', metadata.sessionPairId);
    }

    const newThing = newThingBuilder.build();
    const updatedDataset = setThing(dataset, newThing);
    await saveSolidDatasetAt(chatFileUrl, updatedDataset, { fetch: session.fetch });

  } catch (err) {
    console.error('❌ Error saving message:', err);
  }
};

  const handlePermissionDecision = (granted: boolean) => {
    setSolidPermissionGranted(granted);
    setShowPermissionDialog(false);
  };

  if (authLoading || !isLoggedIn) {
    return (
      <Flex h="100vh" w="100%" align="center" justify="center" direction="column" gap={4}>
        <Spinner size="xl" color="teal.500" thickness="4px" />
        <Text fontSize="sm" color="gray.500">Checking authentication...</Text>
      </Flex>
    );
  }

  return (
    <Box maxW="4xl" mx="auto" py={10} px={4} h="100vh" display="flex" flexDir="column">


      <Flex flex="1" flexDir="column" overflowY="auto" mb={4} p={4} bg="gray.50" borderRadius="md">
        {sessionMessages.map((msg, index) => (
          <Flex key={msg.id || index} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'} mb={4}>
            <Flex maxW="70%" bg={msg.role === 'user' ? 'teal.100' : 'white'} p={3} borderRadius="lg" boxShadow="sm" alignItems="center">
              {msg.role === 'assistant' && <Avatar size="sm" name="Assistant" bg="teal.500" mr={2} />}
              <Text>{msg.content}</Text>
              {msg.role === 'user' && <Avatar size="sm" name="User" bg="gray.500" ml={2} />}
            </Flex>
          </Flex>
        ))}
        {loading && (
          <Flex justify="flex-start" mb={4}>
            <Flex maxW="70%" bg="white" p={3} borderRadius="lg" boxShadow="sm">
              <Avatar size="sm" name="Assistant" bg="teal.500" mr={2} />
              <Spinner />
            </Flex>
          </Flex>
        )}
        <div ref={messagesEndRef} />
      </Flex>
<Flex
  as="form"
  onSubmit={(e) => {
    e.preventDefault();
    handleSendMessage();
  }}
  align="center"
  gap={2}
>
  <Input
    value={inputMessage}
    onChange={(e) => setInputMessage(e.target.value)}
    placeholder="Type your message"
    isDisabled={loading}
    bg="white"
  />
  <Button type="submit" isLoading={loading} colorScheme="blue">
    Send
  </Button>
</Flex>


    </Box>
  );
}
