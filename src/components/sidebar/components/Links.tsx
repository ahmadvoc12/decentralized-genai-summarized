'use client';

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Flex,
  Text,
  List,
  Icon,
  ListItem,
  useColorModeValue,
  Select,
  Button,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import { FaCircle } from 'react-icons/fa';
import { IoMdAdd } from 'react-icons/io';
import NavLink from '@/components/link/NavLink';
import { IRoute } from '@/types/navigation';
import { PropsWithChildren, useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useChatSession } from '@/contexts/ChatSessionContext';

interface SidebarLinksProps extends PropsWithChildren {
  routes: IRoute[];
  loadMessagesFromSolidPod: (name: string) => void;
}

export function SidebarLinks({ routes, loadMessagesFromSolidPod }: SidebarLinksProps) {
  const pathname = usePathname();
  const activeColor = useColorModeValue('navy.700', 'white');
  const inactiveColor = useColorModeValue('gray.500', 'gray.500');
  const activeIcon = useColorModeValue('brand.500', 'white');
  const gray = useColorModeValue('gray.500', 'gray.500');

  const cancelRef = useRef<HTMLButtonElement>(null);

  const {
    sessionsList,
    currentSession,
    createNewSession,
    loadSession,
    selectedAgent,
    setSelectedAgent,
    selectedLLM,
    setSelectedLLM,
  } = useChatSession();

  const { solidPermissionGranted, setSolidPermissionGranted } = useChatSession();

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);

  const activeRoute = useCallback(
    (routeName: string) => pathname?.includes(routeName),
    [pathname]
  );

  const handlePermissionDecision = (granted: boolean) => {
    setSolidPermissionGranted(granted);
    setShowPermissionDialog(false);
    if (granted && pendingSession) {
      loadSession(pendingSession);
      loadMessagesFromSolidPod(pendingSession);
      setPendingSession(null);
    }
  };

  const handleSessionClick = (name: string) => {
    if (!solidPermissionGranted) {
      setPendingSession(name);
      setShowPermissionDialog(true);
    } else {
      loadSession(name);
      loadMessagesFromSolidPod(name);
    }
  };

  const createLinks = (routes: IRoute[]) =>
    routes.map((route, key) => {
      if (route.collapse && !route.invisible) {
        return (
          <Accordion key={key} allowToggle>
            <AccordionItem border="none" mb="14px">
              <AccordionButton _hover={{ bg: 'unset' }} _focus={{ boxShadow: 'none' }}>
                <Flex align="center" w="100%">
                  <Box
                    color={
                      route.disabled
                        ? gray
                        : activeRoute(route.path.toLowerCase())
                        ? activeIcon
                        : inactiveColor
                    }
                    me="12px"
                  >
                    {route.icon}
                  </Box>
                  <Text
                    fontWeight="500"
                    color={
                      route.disabled
                        ? gray
                        : activeRoute(route.path.toLowerCase())
                        ? activeColor
                        : inactiveColor
                    }
                  >
                    {route.name}
                  </Text>
                  <AccordionIcon ms="auto" color={gray} />
                </Flex>
              </AccordionButton>
              <AccordionPanel>
                <List>{route.items ? createAccordionLinks(route.items) : null}</List>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        );
      } else if (!route.invisible) {
        return (
          <NavLink
            key={key}
            href={route.layout ? route.layout + route.path : route.path}
            styles={{ width: '100%' }}
          >
            <Flex align="center" px="4" py="2" borderRadius="md" _hover={{ bg: 'gray.100' }}>
              <Box
                color={
                  route.disabled
                    ? gray
                    : activeRoute(route.path.toLowerCase())
                    ? activeIcon
                    : inactiveColor
                }
                me="12px"
              >
                {route.icon}
              </Box>
              <Text
                color={
                  route.disabled
                    ? gray
                    : activeRoute(route.path.toLowerCase())
                    ? activeColor
                    : inactiveColor
                }
              >
                {route.name}
              </Text>
            </Flex>
          </NavLink>
        );
      }
      return null;
    });

  const createAccordionLinks = (routes: IRoute[]) =>
    routes.map((route: IRoute, key: number) => (
      <ListItem key={key} ms="28px" display="flex" alignItems="center" mb="10px">
        <Icon w="6px" h="6px" me="8px" as={FaCircle} color={activeIcon} />
        <Text
          color={
            route.disabled
              ? gray
              : activeRoute(route.path.toLowerCase())
              ? activeColor
              : inactiveColor
          }
          fontWeight={activeRoute(route.path.toLowerCase()) ? 'bold' : 'normal'}
        >
          {route.name}
        </Text>
      </ListItem>
    ));

  return (
    <>
      <Box px="20px" mt="10px">
        <Flex mb={4} gap={4} align="center">
          <Select value={selectedLLM} onChange={(e) => setSelectedLLM(e.target.value)} w="100%">
            <option value="openai">ChatGPT</option>
            <option value="deepseek">DeepSeek</option>
            <option value="llama33">LLaMA 3.3</option>
            <option value="kimi">Kimi</option>
            <option value="qwen">Qwen</option>
          </Select>
        </Flex>

        <Flex mb={4} gap={4} align="center">
          <Select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} w="100%">
            <option value="default">Default Agent</option>
            <option value="math">Math Agent</option>
          </Select>
        </Flex>

<Button
  colorScheme="teal"
  size="sm"
  w="100%"
  leftIcon={<IoMdAdd />}
  onClick={async () => {
    const newSessionName = await createNewSession(); // <- harus return string | null
    if (newSessionName) {
      loadMessagesFromSolidPod(newSessionName); // langsung gunakan name
    }
  }}
  mb={4}
>
  New Chat
</Button>

        <Box borderTop="1px solid" borderColor="gray.200" pt="10px">
          <Text fontSize="sm" fontWeight="bold" mb="8px" color="gray.600">
            Sessions
          </Text>
          {sessionsList.length > 0 ? (
            sessionsList.map((sessionName) => (
              <Box
                key={sessionName}
                px="10px"
                py="6px"
                mb="6px"
                borderRadius="md"
                bg={sessionName === currentSession ? 'gray.100' : 'transparent'}
                _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                onClick={() => handleSessionClick(sessionName)}
              >
                <Text fontSize="sm" isTruncated>
                  {sessionName}
                </Text>
              </Box>
            ))
          ) : (
            <Text fontSize="sm" color="gray.400">
              No sessions yet.
            </Text>
          )}
        </Box>
      </Box>

      {/* Permission Dialog */}
      <AlertDialog
        isOpen={showPermissionDialog}
        leastDestructiveRef={cancelRef}
        onClose={() => setShowPermissionDialog(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Permission Request
            </AlertDialogHeader>

            <AlertDialogBody>
              Would you like to grant permission to save messages to your Solid Pod?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setShowPermissionDialog(false)}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={() => handlePermissionDecision(true)} ml={3}>
                Yes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

export default SidebarLinks;
