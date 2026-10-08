// File: app/chat/page.tsx
'use client';

import {
  Box, Button, Input, useToast, Spinner, Flex, Text, Avatar,
  AlertDialog, AlertDialogOverlay, AlertDialogContent,
  AlertDialogHeader, AlertDialogBody, AlertDialogFooter
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSolidSession } from '@/contexts/SolidSessionContext';
import { createParser } from 'eventsource-parser';
import {
  getSolidDataset, getThingAll, getStringNoLocale, getUrl, getDatetime,
  saveSolidDatasetAt, setThing, createThing, buildThing,
  createSolidDataset, getPodUrlAll, createContainerAt, getResourceInfo
} from '@inrupt/solid-client';
import { v4 as uuidv4 } from 'uuid';
import { asUrl } from '@inrupt/solid-client';
import { useChatSession } from '@/contexts/ChatSessionContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const toast = useToast();
  const { session, isLoggedIn, loading: authLoading } = useSolidSession();

  const getModelFromProvider = (provider: string): string => {
    const modelMap: Record<string, string> = {
      deepseek: 'deepseek/deepseek-chat:free',
      llama: 'meta-llama/llama-3.3-70b-instruct:free',
      llama33: 'meta-llama/llama-3.3-70b-instruct:free',
      kimi: 'mistralai/mistral-7b-instruct:free',
      qwen: 'qwen/qwen-2.5-72b-instruct:free',
      gemini: 'google/gemini-flash-1.5:free',
    };
    return modelMap[provider] || 'qwen/qwen-2.5-72b-instruct:free';
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
          let podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
          if (!podUrls.length) {
            const fallback = session.info.webId!.replace('/profile/card#me', '/');
            podUrls = [fallback];
          }
          const storage = podUrls[0];
          
          // ✅ REVIEWER FIX 1: Strictly use PRIVATE container, not public
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

  const ensureChatFolderExists = async (storageRoot: string) => {
    // ✅ REVIEWER FIX 1: Path diubah ke private/ untuk menjamin privasi (ACL default Solid memblokir publik)
    const chatFolderUrl = `${storageRoot}private/llm-solid-chat/`;

    try {
      await getResourceInfo(chatFolderUrl, { fetch: session.fetch });
    } catch {
      try {
        await session.fetch(chatFolderUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
            "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
            "Slug": "llm-solid-chat"
          },
          body: ""
        });
      } catch (err) {
        console.error("❌ Failed to create private chat folder:", err);
      }
    }
  };

  const loadChatSessions = async (storageRoot: string) => {
    try {
      const folder = `${storageRoot}private/llm-solid-chat/`;
      const containerDataset = await getSolidDataset(folder, { fetch: session.fetch });
      const things = getThingAll(containerDataset);
      const files = things.map((t) => asUrl(t));

      const sessions = files
        .map((url) => url.split('/').pop() || '')
        .filter((name) => name.endsWith('.ttl'));

      setSessionsList(sessions);
      if (sessions.length) {
        setCurrentSession(sessions[0]);
        await loadMessagesFromSolidPod(sessions[0]);
      }
    } catch (err) {
      console.warn('⚠️ Could not load sessions:', err);
    }
  };

  const newSession = async () => {
    const name = `session-${uuidv4()}.ttl`;
    const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
    const folder = `${podUrls[0]}private/llm-solid-chat/`;
    const newUrl = `${folder}${name}`;
    await saveSolidDatasetAt(newUrl, createSolidDataset(), { fetch: session.fetch });

    setSessionsList((prev) => [name, ...prev]);
    setCurrentSession(name);
    setSessionMessages([]);
    setAllMessages([]);
  };

  const loadMessagesFromSolidPod = async (filename: string) => {
    try {
      const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
      const chatFileUrl = `${podUrls[0]}private/llm-solid-chat/${filename}`;

      const dataset = await getSolidDataset(chatFileUrl, { fetch: session.fetch });
      const things = getThingAll(dataset);

      // ✅ REVIEWER FIX 4 & 5: Parsing RDF yang benar (getDatetime untuk xsd:dateTime, getUrl untuk IRI)
      const parsedMessages = things.map((thing) => {
        const content = getStringNoLocale(thing, 'http://schema.org/text');
        const created = getDatetime(thing, 'http://purl.org/dc/terms/created');
        const id = getStringNoLocale(thing, 'http://purl.org/dc/terms/identifier');
        const attributedTo = getUrl(thing, 'http://www.w3.org/ns/prov#wasAttributedTo');

        // Tentukan role berdasarkan apakah IRI atribusi cocok dengan WebID user
        let role: 'user' | 'assistant' = 'assistant';
        if (attributedTo === session.info.webId) {
          role = 'user';
        }

        if (content && id) {
          return {
            id,
            role,
            content,
            created: created ? created.getTime() : Date.now(),
          };
        }
      }).filter(Boolean) as (Message & { created: number })[];

      parsedMessages.sort((a, b) => a.created - b.created);
      const messages = parsedMessages.map(({ id, role, content }) => ({
        id: id ?? uuidv4(),
        role,
        content,
      }));

      setAllMessages(messages);
      setSessionMessages(messages);
    } catch (err) {
      console.warn('⚠️ Could not load messages from Solid Pod:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentSession) {
      toast({ title: 'Error', description: 'Please enter a message or select session.', status: 'error', duration: 3000, isClosable: true });
      return;
    }

    const userMessage: Message = { id: uuidv4(), role: 'user', content: inputMessage };
    const currentInput = inputMessage;
    
    // ✅ FIX: Gunakan functional update agar pesan tidak hilang/tertimpa
    setSessionMessages((prev) => [
      ...prev,
      { id: userMessage.id || uuidv4(), role: userMessage.role, content: userMessage.content }
    ]);
    setInputMessage('');

    if (session && isLoggedIn && solidPermissionGranted) {
      await saveMessageToSolidPod(userMessage, { modelVersion: model, sessionPairId: currentSession });
    }

    setLoading(true);
    const agentPrompt = selectedAgent === 'math' ? 'You are a calculator. Answer with numeric logic only.' : 'You are a helpful assistant.';
    
    const fullMessages = [
      { role: 'system', content: agentPrompt },
      ...sessionMessages.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: currentInput },
    ];

    try {
      const res = await fetch('/api/chatAPI', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: fullMessages, stream: true, model, provider: selectedLLM }),
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
                return updated;
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
          { modelVersion: model, sessionPairId: currentSession }
        );
      }

      toast({ title: 'Success', description: `Received response from ${selectedLLM}.`, status: 'success', duration: 3000, isClosable: true });

    } catch (err: any) {
      console.error('Error during fetch:', err);
      setSessionMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  // ✅ REVIEWER FIX 2, 3, 4, 5: Perbaikan Pemodelan RDF secara Lengkap
  const saveMessageToSolidPod = async (
    msg: Message,
    metadata?: { modelVersion?: string; sessionPairId?: string }
  ) => {
    try {
      const podUrls = await getPodUrlAll(session.info.webId!, { fetch: session.fetch });
      const chatFileUrl = `${podUrls[0]}private/llm-solid-chat/${currentSession}`;

      let dataset;
      try {
        dataset = await getSolidDataset(chatFileUrl, { fetch: session.fetch });
      } catch {
        dataset = createSolidDataset();
      }

      // REVIEWER FIX 3: Setiap pesan HARUS memiliki Subject IRI yang unik
      const messageIri = `${chatFileUrl}#msg-${msg.id}`;
      
      let newThingBuilder = buildThing(createThing({ url: messageIri }))
        // REVIEWER FIX 4: Menambahkan rdf:type yang hilang
        .addUrl('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://schema.org/Message')
        // Menggunakan schema:text untuk konten
        .addStringNoLocale('http://schema.org/text', msg.content)
        // REVIEWER FIX 5: Menggunakan addDatetime agar otomatis memiliki datatype ^^xsd:dateTime
        .addDatetime('http://purl.org/dc/terms/created', new Date())
        .addStringNoLocale('http://purl.org/dc/terms/identifier', msg.id || uuidv4());

      // REVIEWER FIX 2: Hapus schema:about yang salah. Gunakan prov:wasAttributedTo dengan IRI yang valid.
      if (msg.role === 'user' && session.info.webId) {
        // User diatribusikan ke WebID mereka sendiri (IRI valid)
        newThingBuilder = newThingBuilder.addUrl(
          'http://www.w3.org/ns/prov#wasAttributedTo',
          session.info.webId
        );
      } else if (msg.role === 'assistant' && metadata?.modelVersion) {
        // Assistant diatribusikan ke IRI Software Agent yang valid (bukan string literal)
        // Contoh: https://openrouter.ai/google/gemini-flash-1.5
        const cleanModel = metadata.modelVersion.replace(':', '/');
        const agentIri = `https://openrouter.ai/${cleanModel}`;
        
        newThingBuilder = newThingBuilder.addUrl(
          'http://www.w3.org/ns/prov#wasAttributedTo',
          agentIri
        );
      }

      if (metadata?.sessionPairId) {
        newThingBuilder = newThingBuilder.addStringNoLocale(
          'http://schema.org/isPartOf', 
          metadata.sessionPairId
        );
      }

      const newThing = newThingBuilder.build();
      const updatedDataset = setThing(dataset, newThing);
      await saveSolidDatasetAt(chatFileUrl, updatedDataset, { fetch: session.fetch });

    } catch (err) {
      console.error('❌ Error saving message to Pod:', err);
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
            <Flex 
              maxW="80%" 
              bg={msg.role === 'user' ? 'teal.100' : 'white'} 
              p={4} 
              borderRadius="lg" 
              boxShadow="sm" 
              alignItems={msg.role === 'assistant' ? 'flex-start' : 'center'}
            >
              {msg.role === 'assistant' && <Avatar size="sm" name="Assistant" bg="teal.500" mr={3} mt={1} />}
              
              {/* ✅ RENDER MARKDOWN untuk Assistant */}
              {msg.role === 'assistant' ? (
                <Box 
                  className="markdown-content" 
                  fontSize="sm" 
                  lineHeight="1.6"
                  sx={{
                    'p': { marginBottom: '0.5em' },
                    'pre': { background: '#f4f4f4', padding: '10px', borderRadius: '6px', overflowX: 'auto', fontSize: '0.85em', color: '#333' },
                    'code': { background: '#f4f4f4', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', color: '#333' },
                    'ul, ol': { paddingLeft: '1.2em', marginBottom: '0.5em' },
                    'li': { marginBottom: '0.25em' },
                    'a': { color: 'teal.600', textDecoration: 'underline' }
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </Box>
              ) : (
                <Text whiteSpace="pre-wrap">{msg.content}</Text>
              )}

              {msg.role === 'user' && <Avatar size="sm" name="User" bg="gray.500" ml={3} mt={1} />}
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
      
      <Flex as="form" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} align="center" gap={2}>
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message"
          isDisabled={loading}
          bg="white"
        />
        <Button type="submit" isLoading={loading} colorScheme="blue">Send</Button>
      </Flex>

      <AlertDialog isOpen={showPermissionDialog} leastDestructiveRef={cancelRef} onClose={() => setShowPermissionDialog(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Save Chat Permission</AlertDialogHeader>
            <AlertDialogBody>Do you want to save this chat history to your private Solid Pod?</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => handlePermissionDecision(false)}>No</Button>
              <Button colorScheme="blue" onClick={() => handlePermissionDecision(true)} ml={3}>Yes</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}