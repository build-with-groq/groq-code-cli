import test from 'ava';
import sinon from 'sinon';
import { renderHook, act } from '@testing-library/react';
import { useTokenMetrics } from '@src/ui/hooks/useTokenMetrics';

// Helper function to create and restore fake timers
const withFakeTimers = (testFn: (clock: sinon.SinonFakeTimers) => void) => {
  const clock = sinon.useFakeTimers();
  try {
    testFn(clock);
  } finally {
    clock.restore();
  }
};

test('useTokenMetrics - initial state - should initialize with default values', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  t.is(result.current.completionTokens, 0);
  t.is(result.current.startTime, null);
  t.is(result.current.endTime, null);
  t.is(result.current.pausedTime, 0);
  t.is(result.current.isPaused, false);
  t.is(result.current.isActive, false);
});

test('useTokenMetrics - initial state - should provide all required methods', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  t.is(typeof result.current.startRequest, 'function');
  t.is(typeof result.current.addApiTokens, 'function');
  t.is(typeof result.current.pauseMetrics, 'function');
  t.is(typeof result.current.resumeMetrics, 'function');
  t.is(typeof result.current.completeRequest, 'function');
  t.is(typeof result.current.resetMetrics, 'function');
});

test('useTokenMetrics - startRequest - should start a new request with correct initial state', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  t.is(result.current.isActive, true);
  t.is(result.current.isPaused, false);
  t.is(result.current.completionTokens, 0);
  t.true(result.current.startTime instanceof Date);
  t.is(result.current.endTime, null);
  t.is(result.current.pausedTime, 0);
});

test('useTokenMetrics - startRequest - should reset previous request data', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  // Start and add tokens to first request
  act(() => {
    result.current.startRequest();
    result.current.addApiTokens({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    });
  });

  t.is(result.current.completionTokens, 20);

  // Start new request
  act(() => {
    result.current.startRequest();
  });

  t.is(result.current.completionTokens, 0);
  t.is(result.current.isActive, true);
  t.is(result.current.pausedTime, 0);
});

test('useTokenMetrics - startRequest - should set start time to current time', (t) => {
  withFakeTimers((clock) => {
    const mockDate = new Date('2024-01-01T10:00:00Z');
    clock.setSystemTime(mockDate);

    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
    });

    t.is(result.current.startTime?.getTime(), mockDate.getTime());
  });
});

test('useTokenMetrics - addApiTokens - should accumulate completion tokens', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  act(() => {
    result.current.addApiTokens({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    });
  });

  t.is(result.current.completionTokens, 20);

  act(() => {
    result.current.addApiTokens({
      prompt_tokens: 15,
      completion_tokens: 30,
      total_tokens: 45
    });
  });

  t.is(result.current.completionTokens, 50);
});

test('useTokenMetrics - addApiTokens - should handle zero token usage', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  act(() => {
    result.current.addApiTokens({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    });
  });

  t.is(result.current.completionTokens, 0);
});

test('useTokenMetrics - addApiTokens - should work without starting a request', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.addApiTokens({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    });
  });

  t.is(result.current.completionTokens, 20);
});

test('useTokenMetrics - addApiTokens - should only use completion_tokens from usage', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  act(() => {
    result.current.addApiTokens({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    });
  });

  t.is(result.current.completionTokens, 50);
});

test('useTokenMetrics - pauseMetrics - should pause metrics correctly', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  act(() => {
    result.current.pauseMetrics();
  });

  t.is(result.current.isPaused, true);
  t.is(result.current.isActive, true);
});

test('useTokenMetrics - pauseMetrics - should not pause if already paused', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.pauseMetrics();
  });

  const firstPauseTime = result.current.isPaused;

  act(() => {
    result.current.pauseMetrics();
  });

  t.is(result.current.isPaused, firstPauseTime);
});

test('useTokenMetrics - pauseMetrics - should work without starting a request', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.pauseMetrics();
  });

  t.is(result.current.isPaused, true);
  t.is(result.current.isActive, false);
});

test('useTokenMetrics - pauseMetrics - should set pause start time', (t) => {
  withFakeTimers((clock) => {
    const mockDate = new Date('2024-01-01T10:00:00Z');
    clock.setSystemTime(mockDate);

    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.pauseMetrics();
    });

    t.is(result.current.isPaused, true);
  });
});

test('useTokenMetrics - resumeMetrics - should resume from pause correctly', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.pauseMetrics();
    });

    // Advance time by 1000ms during pause
    act(() => {
      clock.tick(1000);
      result.current.resumeMetrics();
    });

    t.is(result.current.isPaused, false);
    t.is(result.current.isActive, true);
    t.is(result.current.pausedTime, 1000);
  });
});

test('useTokenMetrics - resumeMetrics - should not resume if not paused', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  const initialPausedTime = result.current.pausedTime;

  act(() => {
    result.current.resumeMetrics();
  });

  t.is(result.current.pausedTime, initialPausedTime);
  t.is(result.current.isPaused, false);
});

test('useTokenMetrics - resumeMetrics - should accumulate multiple pause durations', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
    });

    // First pause
    act(() => {
      result.current.pauseMetrics();
      clock.tick(500);
      result.current.resumeMetrics();
    });

    t.is(result.current.pausedTime, 500);

    // Second pause
    act(() => {
      result.current.pauseMetrics();
      clock.tick(300);
      result.current.resumeMetrics();
    });

    t.is(result.current.pausedTime, 800);
  });
});

test('useTokenMetrics - resumeMetrics - should calculate pause duration correctly', (t) => {
  withFakeTimers((clock) => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    clock.setSystemTime(startTime);

    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.pauseMetrics();
    });

    const resumeTime = new Date('2024-01-01T10:00:02.500Z');
    clock.setSystemTime(resumeTime);

    act(() => {
      result.current.resumeMetrics();
    });

    t.is(result.current.pausedTime, 2500);
  });
});

test('useTokenMetrics - completeRequest - should complete request correctly', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
  });

  act(() => {
    result.current.completeRequest();
  });

  t.is(result.current.isActive, false);
  t.is(result.current.isPaused, false);
  t.true(result.current.endTime instanceof Date);
});

test('useTokenMetrics - completeRequest - should handle completion while paused', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.pauseMetrics();
      clock.tick(1000);
      result.current.completeRequest();
    });

    t.is(result.current.isActive, false);
    t.is(result.current.isPaused, false);
    t.is(result.current.pausedTime, 1000);
    t.true(result.current.endTime instanceof Date);
  });
});

test('useTokenMetrics - completeRequest - should work without starting a request', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.completeRequest();
  });

  t.is(result.current.isActive, false);
  t.true(result.current.endTime instanceof Date);
});

test('useTokenMetrics - completeRequest - should set end time to current time', (t) => {
  withFakeTimers((clock) => {
    const mockDate = new Date('2024-01-01T10:00:05Z');
    clock.setSystemTime(mockDate);

    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.completeRequest();
    });

    t.is(result.current.endTime?.getTime(), mockDate.getTime());
  });
});

test('useTokenMetrics - completeRequest - should handle multiple completions', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      result.current.completeRequest();
    });

    const firstEndTime = result.current.endTime;

    act(() => {
      clock.tick(1000);
      result.current.completeRequest();
    });

    t.true(result.current.endTime!.getTime() > firstEndTime!.getTime());
  });
});

test('useTokenMetrics - resetMetrics - should reset all metrics to initial state', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    // Set up some state
    act(() => {
      result.current.startRequest();
      result.current.addApiTokens({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
      result.current.pauseMetrics();
      clock.tick(1000);
      result.current.resumeMetrics();
      result.current.completeRequest();
    });

    // Verify state is set
    t.is(result.current.completionTokens, 20);
    t.is(result.current.pausedTime, 1000);

    // Reset
    act(() => {
      result.current.resetMetrics();
    });

    // Verify reset to initial state
    t.is(result.current.completionTokens, 0);
    t.is(result.current.startTime, null);
    t.is(result.current.endTime, null);
    t.is(result.current.pausedTime, 0);
    t.is(result.current.isPaused, false);
    t.is(result.current.isActive, false);
  });
});

test('useTokenMetrics - resetMetrics - should reset while request is active', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.addApiTokens({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    });
  });

  t.is(result.current.isActive, true);

  act(() => {
    result.current.resetMetrics();
  });

  t.is(result.current.isActive, false);
  t.is(result.current.completionTokens, 0);
});

test('useTokenMetrics - resetMetrics - should reset while paused', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.pauseMetrics();
  });

  t.is(result.current.isPaused, true);

  act(() => {
    result.current.resetMetrics();
  });

  t.is(result.current.isPaused, false);
});

test('useTokenMetrics - complex workflows - should handle full request lifecycle', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    const startTime = new Date('2024-01-01T10:00:00Z');
    clock.setSystemTime(startTime);

    // Start request
    act(() => {
      result.current.startRequest();
    });

    t.is(result.current.isActive, true);
    t.is(result.current.startTime?.getTime(), startTime.getTime());

    // Add tokens
    act(() => {
      result.current.addApiTokens({
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      });
    });

    // Pause for approval
    act(() => {
      result.current.pauseMetrics();
      clock.tick(2000); // 2 seconds pause
      result.current.resumeMetrics();
    });

    // Add more tokens
    act(() => {
      result.current.addApiTokens({
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15
      });
    });

    const endTime = new Date('2024-01-01T10:00:10Z');
    clock.setSystemTime(endTime);

    // Complete request
    act(() => {
      result.current.completeRequest();
    });

    t.is(result.current.isActive, false);
    t.is(result.current.completionTokens, 25);
    t.is(result.current.pausedTime, 2000);
    t.is(result.current.endTime?.getTime(), endTime.getTime());
  });
});

test('useTokenMetrics - complex workflows - should handle multiple pause/resume cycles', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
    });

    // Multiple pause/resume cycles
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.pauseMetrics();
        clock.tick(1000);
        result.current.resumeMetrics();
      });
    }

    t.is(result.current.pausedTime, 3000);
  });
});

test('useTokenMetrics - complex workflows - should handle token accumulation across pauses', (t) => {
  withFakeTimers((clock) => {
    const { result } = renderHook(() => useTokenMetrics());

    act(() => {
      result.current.startRequest();
      
      result.current.addApiTokens({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
      
      result.current.pauseMetrics();
      clock.tick(1000);
      result.current.resumeMetrics();
      
      result.current.addApiTokens({
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15
      });
    });

    t.is(result.current.completionTokens, 30);
    t.is(result.current.pausedTime, 1000);
  });
});

test('useTokenMetrics - complex workflows - should handle rapid state changes', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.pauseMetrics();
    result.current.resumeMetrics();
    result.current.pauseMetrics();
    result.current.completeRequest();
  });

  t.is(result.current.isActive, false);
  t.is(result.current.isPaused, false);
});

test('useTokenMetrics - edge cases - should handle zero duration pauses', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.pauseMetrics();
    result.current.resumeMetrics();
  });

  t.true(result.current.pausedTime >= 0);
});

test('useTokenMetrics - edge cases - should handle negative token values', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.addApiTokens({
      prompt_tokens: -5,
      completion_tokens: -10,
      total_tokens: -15
    });
  });

  t.is(result.current.completionTokens, -10);
});

test('useTokenMetrics - edge cases - should handle very large token values', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  act(() => {
    result.current.startRequest();
    result.current.addApiTokens({
      prompt_tokens: 1000000,
      completion_tokens: 999999,
      total_tokens: 1999999
    });
  });

  t.is(result.current.completionTokens, 999999);
});

test('useTokenMetrics - edge cases - should maintain state consistency across many operations', (t) => {
  const { result } = renderHook(() => useTokenMetrics());

  // Perform many operations
  for (let i = 0; i < 100; i++) {
    act(() => {
      if (i % 10 === 0) {
        result.current.startRequest();
      } else if (i % 5 === 0) {
        result.current.pauseMetrics();
      } else if (i % 3 === 0) {
        result.current.resumeMetrics();
      } else {
        result.current.addApiTokens({
          prompt_tokens: 1,
          completion_tokens: 2,
          total_tokens: 3
        });
      }
    });
  }

  // State should still be consistent
  t.is(typeof result.current.completionTokens, 'number');
  t.is(typeof result.current.pausedTime, 'number');
  t.is(typeof result.current.isActive, 'boolean');
  t.is(typeof result.current.isPaused, 'boolean');
});