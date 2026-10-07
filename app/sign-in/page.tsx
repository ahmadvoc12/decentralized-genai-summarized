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

  // 1. Redirect otomatis jika sudah login
  useEffect(() => {
    if (isLoggedIn) {
      console.log('[Sign-In] ✅ User sudah login, redirecting ke home...');
      // Next.js router otomatis menangani basePath jika dikonfigurasi di next.config.js
      router.replace('/');
    }
  }, [isLoggedIn, router]);

  // 2. Set default Identity Provider
  useEffect(() => {
    setIdp('https://login.inrupt.com');
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
      // 3. Logika BasePath yang Aman untuk Local & Production
      const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      // Pastikan tidak ada double slash. Jika kosong, biarkan kosong.
      const cleanBasePath = rawBasePath === '' ? '' : (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`);
      
      // 4. Konstruksi URL Redirect yang Presisi
      const finalRedirectUrl = `${window.location.origin}${cleanBasePath}/callback`;
      
      // 5. Logging untuk Debugging (Sangat Penting!)
      console.log('=========================================');
      console.log('[Sign-In] 🔑 Attempting Solid Login...');
      console.log('[Sign-In] 🌐 Window Origin:', window.location.origin);
      console.log('[Sign-In] 📁 BasePath:', cleanBasePath || '(kosong/root)');
      console.log('[Sign-In] 🎯 Final Redirect URL:', finalRedirectUrl);
      console.log('=========================================');

      await session.login({
        oidcIssuer: idp,
        redirectUrl: finalRedirectUrl,
        clientName: 'DIKE-Chat', // Nama client yang jelas
        // prompt: 'consent', // <-- HAPUS KOMENTAR INI jika Anda ingin memaksa layar izin Solid Provider muncul lagi
      });
      
      // Catatan: Setelah session.login() berhasil, halaman akan di-redirect 
      // ke Solid Provider, lalu kembali ke URL redirectUrl di atas.
    } catch (error: any) {
      console.error('[Sign-In] ❌ Login error:', error);
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
          loadingText="Connecting to Solid..."
        >
          Login
        </Button>
      </Box>

      {/* 2. Panduan Testing Lokal */}


    </VStack>
  );
}