// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { Attachment } from '../types.js';
import { useSubmitHandler } from './useSubmitHandler';

function createCompletion() {
  return {
    close: vi.fn(),
  };
}

function useSubmitHandlerHarness({
  getTextContent,
  onSubmit,
}: {
  getTextContent: () => string;
  onSubmit: (content: string) => void;
}) {
  const [, setInternalAttachments] = useState<Attachment[]>([]);
  return useSubmitHandler({
    getTextContent,
    attachments: [],
    sdkStatusLoading: false,
    sdkInstalled: true,
    currentProvider: 'codex',
    clearInput: vi.fn(),
    cancelPendingInput: vi.fn(),
    invalidateCache: vi.fn(),
    externalAttachments: undefined,
    setInternalAttachments,
    fileCompletion: createCompletion(),
    memoryCompletion: createCompletion(),
    noteCardCompletion: createCompletion(),
    commandCompletion: createCompletion(),
    skillCompletion: createCompletion(),
    agentCompletion: createCompletion(),
    promptCompletion: createCompletion(),
    recordInputHistory: vi.fn(),
    onSubmit,
    t: (key) => key,
  });
}

describe('useSubmitHandler', () => {
  it('dedupes repeated submit calls until the deferred submit frame settles', () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    const onSubmit = vi.fn();
    const getTextContent = vi.fn(() => 'send once');
    const { result } = renderHook(() =>
      useSubmitHandlerHarness({ getTextContent, onSubmit }),
    );

    act(() => {
      result.current();
      result.current();
    });

    expect(frameCallbacks).toHaveLength(1);
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => {
      frameCallbacks.shift()?.(performance.now());
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('send once', undefined);

    act(() => {
      result.current();
    });

    expect(frameCallbacks).toHaveLength(1);

    requestAnimationFrameSpy.mockRestore();
  });
});
