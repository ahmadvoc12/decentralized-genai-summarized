'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSolidSession } from '@/contexts/SolidSessionContext';
import { Flex, Spinner, Text } from '@chakra-ui/react';

export default function CallbackPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useSolidSession();

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn) {
        router.replace('/');
      } else {
        router.replace('/sign-in');
      }
    }
  }, [isLoggedIn, loading, router]);

  return (
    <Flex h="100vh" w="100%" align="center" justify="center" direction="column" gap={4}>
      <Spinner size="xl" color="teal.500" thickness="4px" />
      <Text fontSize="sm" color="gray.500">Completing authentication...</Text>
    </Flex>
  );
}