'use client';

import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Box,
  FormControl,
  FormLabel,
  Heading,
  useToast,
  UnorderedList,
  ListItem,
  Link,
  VStack,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useSolidSession } from '@/contexts/SolidSessionContext';

export default function SolidLoginPage() {
  const [idp, setIdp] = useState('');
  const [loading, setLoading] = useState(false);
  const { session, isLoggedIn } = useSolidSession();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/');
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    setIdp('https://login.inrupt.com'); // Default OIDC Issuer
  }, []);

  async function handleLogin() {
    if (!idp) {
      toast({
        title: 'Error',
        description: 'OIDC Issuer is required',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      await session.login({
        oidcIssuer: idp,
        redirectUrl: window.location.origin + basePath + '/callback',
        clientName: 'Chat UI',
      });
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'An error occurred during login',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setLoading(false);
    }
  }

  return (
    <VStack spacing={6} align="center" maxW="2xl" mx="auto" mt="10" px={4}>
      
      {/* 1. Login Form */}
      <Box w="full" maxW="md" p="6" borderWidth="1px" borderRadius="md" boxShadow="md" bg="white">
        <Heading mb="6" textAlign="center" size="md">Solid Login</Heading>
        <FormControl mb="6" isRequired>
          <FormLabel>Identity Provider (OIDC Issuer)</FormLabel>
          <Input
            placeholder="https://login.inrupt.com"
            value={idp}
            onChange={(e) => setIdp(e.target.value)}
            autoComplete="off"
          />
        </FormControl>
        <Button
          colorScheme="blue"
          width="full"
          onClick={handleLogin}
          isLoading={loading}
          loadingText="Connecting..."
        >
          Login
        </Button>
      </Box>

      {/* 2. Testing Guidelines */}
      <Box w="full" maxW="md" p="6" borderWidth="1px" borderRadius="md" boxShadow="sm" bg="gray.50">
        <Heading mb="4" textAlign="center" size="sm" color="gray.700">
          📋 DIKE-Chat Guide
        </Heading>
        <UnorderedList spacing={3} color="gray.700" fontSize="sm">
          <ListItem>
            Access the DIKE-Chat site via this link: <Link color="blue.600" fontWeight="medium" href="http://31.97.190.72/dikechat/" isExternal>http://31.97.190.72/dikechat/</Link> (use incognito mode if necessary).
          </ListItem>
          <ListItem>Click the <strong>Sign Up</strong> button to create an account.</ListItem>
          <ListItem>Fill out the registration form with your details.</ListItem>
          <ListItem>Open your email and verify your account via the provided link.</ListItem>
          <ListItem>After verification is complete, return to the DIKE-Chat page and click <strong>Continue</strong> to proceed to login.</ListItem>
          <ListItem>Before logging into DIKE-Chat, visit <Link color="blue.600" fontWeight="medium" href="https://id.inrupt.com/" isExternal>https://id.inrupt.com/</Link></ListItem>
          <ListItem>Log in using your verified account.</ListItem>
          <ListItem>Click the <strong>Get a Pod</strong> button to get access to your personal data storage.</ListItem>
          <ListItem>Return to the DIKE-Chat page and log in again.</ListItem>
          <ListItem>Once inside DIKE-Chat, click the <strong>New Chat</strong> button to start a conversation.</ListItem>
          <ListItem>Use the <strong>DeepSeek</strong> and <strong>Qwen</strong> LLMs alternately (use the LLM switch feature on the platform).</ListItem>
        </UnorderedList>
      </Box>

    </VStack>
  );
}