import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import DiffPreview from '../display/DiffPreview.js';

interface PendingToolApprovalProps {
  toolName: string;
  toolArgs: Record<string, any>;
  onApprove: () => void;
  onReject: () => void;
  onApproveWithAutoSession?: () => void;
  onApproveWithAlwaysPath?: () => void;
}

const WRITE_TOOLS = new Set(['write_file', 'edit_file']);

export default function PendingToolApproval({
  toolName,
  toolArgs,
  onApprove,
  onReject,
  onApproveWithAutoSession,
  onApproveWithAlwaysPath,
}: PendingToolApprovalProps) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [toolName, toolArgs]);

  const isWrite = WRITE_TOOLS.has(toolName);
  const hasPath = typeof toolArgs?.file_path === 'string' || typeof toolArgs?.path === 'string';
  const danger = toolName === 'execute_command';

  useInput((input, key) => {
    if (key.upArrow) setSelected((p) => Math.max(0, p - 1));
    else if (key.downArrow) setSelected((p) => Math.min(maxOptions(), p + 1));
    else if (key.return) {
      switch (selected) {
        case 0:
          onApprove();
          break;
        case 1:
          if (isWrite && hasPath) onApproveWithAlwaysPath?.();
          else onApproveWithAutoSession?.();
          break;
        case 2:
          if (isWrite && hasPath) onApproveWithAutoSession?.();
          else onReject();
          break;
        case 3:
          onReject();
          break;
      }
    }
  });

  const maxOptions = () => {
    if (danger) return 0; // only approve/reject for commands
    if (isWrite && hasPath) return 3; // approve / always path / auto-session / reject
    if (isWrite) return 2; // approve / auto-session / reject
    return 1; // approve / reject
  };

  const filename = (() => {
    const fp = toolArgs?.file_path || toolArgs?.path;
    if (!fp) return null;
    return String(fp).split('/').pop() || String(fp);
  })();

  const Option = ({ index, label, color }: { index: number; label: string; color: string }) => (
    <Box>
      <Text
        color={selected === index ? 'black' : color}
        backgroundColor={selected === index ? 'rgb(124,214,114)' : undefined}
      >
        {selected === index ? <Text bold>{'>'}</Text> : '  '} {label}
      </Text>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="yellow">
          🟡 <Text bold>{danger ? 'Run command' : toolName}</Text>
        </Text>
      </Box>

      {danger ? (
        <Box>
          <Text color="gray">Command:</Text>{' '}
          <Text color="white">{String(toolArgs?.command || '').slice(0, 200)}</Text>
        </Box>
      ) : (
        <>
          {(toolName === 'write_file' || toolName === 'edit_file') && (
            <Box borderStyle="round" borderColor="yellow" paddingX={1}>
              <DiffPreview toolName={toolName} toolArgs={toolArgs} />
            </Box>
          )}
          <Box>
            <Text color="gray">
              {filename
                ? <>Editing <Text bold>{filename}</Text></>
                : toolName}
            </Text>
          </Box>
        </>
      )}

      <Box flexDirection="column">
        <Text color="yellow">
          {danger ? 'Approve running this command?' : `Approve this edit to ${filename || toolName}?`}
        </Text>

        {danger ? (
          <>
            <Option index={0} label="Yes (run once)" color="green" />
            <Option index={1} label="No, tell me what to do differently" color="red" />
          </>
        ) : (
          <>
            <Option index={0} label="Yes" color="green" />
            {isWrite && hasPath && <Option index={1} label="Yes, and always allow this path" color="blue" />}
            {isWrite && <Option index={2} label="Yes, and don't ask again this session" color="blue" />}
            <Option index={menuRejectIndex()} label="No, tell me what to do differently" color="red" />
          </>
        )}
      </Box>
    </Box>
  );

  function menuRejectIndex(): number {
    if (isWrite && hasPath) return 3;
    if (isWrite) return 2;
    return 1;
  }
}