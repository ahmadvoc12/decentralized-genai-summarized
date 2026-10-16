'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Text,
  UnorderedList,
  OrderedList,
  ListItem,
  Code,
  Link,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const codeBg = useColorModeValue('gray.100', 'whiteAlpha.200');
  const codeBlockBg = useColorModeValue('#1E1E2E', '#181825');
  const blockquoteBorder = useColorModeValue('teal.500', 'teal.300');
  const blockquoteBg = useColorModeValue('teal.50', 'whiteAlpha.50');
  const tableBorder = useColorModeValue('gray.200', 'whiteAlpha.300');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  return (
    <Box
      className="markdown-content"
      fontSize="sm"
      lineHeight="1.7"
      color={textColor}
      wordBreak="break-word"
      sx={{
        '& > *:last-child': {
          mb: 0,
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <Text mb={3} _last={{ mb: 0 }} lineHeight="1.7">
              {children}
            </Text>
          ),
          ul: ({ children }) => (
            <UnorderedList pl={5} mb={3} spacing={1.5} _last={{ mb: 0 }}>
              {children}
            </UnorderedList>
          ),
          ol: ({ children }) => (
            <OrderedList pl={5} mb={3} spacing={1.5} _last={{ mb: 0 }}>
              {children}
            </OrderedList>
          ),
          li: ({ children }) => (
            <ListItem lineHeight="1.7">
              {children}
            </ListItem>
          ),
          strong: ({ children }) => (
            <Text as="span" fontWeight="700">
              {children}
            </Text>
          ),
          em: ({ children }) => (
            <Text as="span" fontStyle="italic">
              {children}
            </Text>
          ),
          h1: ({ children }) => (
            <Heading as="h1" size="md" mt={4} mb={2} fontWeight="bold">
              {children}
            </Heading>
          ),
          h2: ({ children }) => (
            <Heading as="h2" size="sm" mt={3.5} mb={2} fontWeight="bold">
              {children}
            </Heading>
          ),
          h3: ({ children }) => (
            <Heading as="h3" size="xs" mt={3} mb={1.5} fontWeight="semibold">
              {children}
            </Heading>
          ),
          blockquote: ({ children }) => (
            <Box
              borderLeft="4px solid"
              borderColor={blockquoteBorder}
              pl={3}
              py={1.5}
              my={2.5}
              bg={blockquoteBg}
              borderRadius="sm"
              fontStyle="italic"
            >
              {children}
            </Box>
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <Code
                  px={1.5}
                  py={0.5}
                  borderRadius="md"
                  fontSize="xs"
                  bg={codeBg}
                  color="teal.600"
                  fontWeight="600"
                  {...props}
                >
                  {children}
                </Code>
              );
            }
            return (
              <Box
                as="pre"
                p={3.5}
                my={3}
                borderRadius="lg"
                bg={codeBlockBg}
                color="gray.100"
                overflowX="auto"
                fontSize="xs"
                fontFamily="mono"
                boxShadow="sm"
              >
                <code className={className} {...props}>
                  {children}
                </code>
              </Box>
            );
          },
          table: ({ children }) => (
            <Box overflowX="auto" my={3} border="1px solid" borderColor={tableBorder} borderRadius="md">
              <Table size="sm" variant="simple">
                {children}
              </Table>
            </Box>
          ),
          thead: ({ children }) => <Thead bg={codeBg}>{children}</Thead>,
          tbody: ({ children }) => <Tbody>{children}</Tbody>,
          tr: ({ children }) => <Tr>{children}</Tr>,
          th: ({ children }) => <Th py={2} px={3}>{children}</Th>,
          td: ({ children }) => <Td py={2} px={3} borderTop="1px solid" borderColor={tableBorder}>{children}</Td>,
          hr: () => <Divider my={3} />,
          a: ({ href, children }) => (
            <Link
              href={href}
              color="teal.500"
              isExternal
              textDecoration="underline"
              _hover={{ color: 'teal.600' }}
            >
              {children}
            </Link>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}

export default MarkdownRenderer;
