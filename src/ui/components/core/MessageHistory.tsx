import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage } from '../../hooks/useAgent.js';
import ToolHistoryItem from '../display/ToolHistoryItem.js';
import Stats from '../display/Stats.js';
import { parseMarkdown, MarkdownElement, parseInlineElements } from '../../../utils/markdown.js';

interface Usage {
  queue_time: number;
  prompt_tokens: number;
  prompt_time: number;
  completion_tokens: number;
  completion_time: number;
  total_tokens: number;
  total_requests?: number;
  total_time: number;
}

interface MessageHistoryProps {
  messages: ChatMessage[];
  showReasoning?: boolean;
  usageData?: Usage;
}

export default function MessageHistory({ messages, showReasoning = true, usageData }: MessageHistoryProps) {
  const scrollRef = useRef<any>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToBottom?.();
    }
  }, [messages.length]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: ChatMessage) => {
    const timestamp = formatTimestamp(message.timestamp);
    
    switch (message.role) {
      case 'user':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="cyan" bold>{'>'} </Text>
            <Text color="gray">{message.content}</Text>
          </Box>
        );
        
      case 'assistant':
        const markdownElements = parseMarkdown(message.content);
        return (
          <Box key={message.id} marginBottom={1} flexDirection="column">
            {/* Render reasoning if present and showReasoning is enabled */}
            {message.reasoning && showReasoning && (
              <Box marginBottom={1}>
                <Text italic dimColor>
                  {message.reasoning}
                </Text>
              </Box>
            )}
            {/* Render content only if it exists */}
            {message.content && markdownElements.map((element, index) => {
              switch (element.type) {
                case 'code-block':
                  return (
                    <Box key={index} marginY={1} paddingLeft={2}>
                      <Text color="cyan">{element.content}</Text>
                    </Box>
                  );
                case 'heading':
                  return (
                    <Text key={index} bold color={element.level && element.level <= 2 ? "yellow" : "white"}>
                      {element.content}
                    </Text>
                  );
                case 'mixed-line':
                  const inlineElements = parseInlineElements(element.content);
                  return (
                    <Text key={index}>
                      {inlineElements.map((inlineElement, inlineIndex) => {
                        switch (inlineElement.type) {
                          case 'code':
                            return <Text key={inlineIndex} color="cyan">{inlineElement.content}</Text>;
                          case 'bold':
                            return <Text key={inlineIndex} bold>{inlineElement.content}</Text>;
                          case 'italic':
                            return <Text key={inlineIndex} italic>{inlineElement.content}</Text>;
                          default:
                            return <Text key={inlineIndex}>{inlineElement.content}</Text>;
                        }
                      })}
                    </Text>
                  );
                default:
                  return <Text key={index}>{element.content}</Text>;
              }
            })}
          </Box>
        );
        
      case 'system':
        // Handle special system message types
        if (message.type === 'stats') {
          return (
            <Box key={message.id} marginBottom={1}>
              <Stats usage={message.usageSnapshot || usageData} />
            </Box>
          );
        }
        
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="yellow" italic>
              {message.content}
            </Text>
          </Box>
        );
        
      case 'tool_execution':
        if (message.toolExecution) {
          return (
            <Box key={message.id} marginBottom={1}>
              <ToolHistoryItem execution={message.toolExecution} />
            </Box>
          );
        }
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="blue">Tool: {message.content}</Text>
          </Box>
        );
        
      default:
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="gray" dimColor>
              Unknown: {message.content}
            </Text>
          </Box>
        );
    }
  };

  return (
    <Box ref={scrollRef} flexDirection="column" flexGrow={1}>
      {messages.length === 0 ? (
        <Box justifyContent="center" paddingY={2} flexDirection="column" alignItems="center">
          <Text color="gray" dimColor italic>
            Ask for help with coding tasks, debugging issues, or explaining code.
          </Text>
          <Text color="gray" dimColor italic>
            Type /help for available commands and features.
          </Text>
        </Box>
      ) : (
        messages.map(renderMessage)
      )}
    </Box>
  );
}