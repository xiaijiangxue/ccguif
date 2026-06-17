import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  collectTodoItems,
  resolveDefaultTodoFloatingPosition,
} from "./todoFloatingWindow";

function taskCreateTool(id: string, description: string): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskCreate",
    title: "Task Create",
    detail: JSON.stringify({ description }),
    status: "completed",
  };
}

function taskCreateToolWithTaskId(
  id: string,
  taskId: string,
  description: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskCreate",
    title: "Taskcreate",
    detail: JSON.stringify({ task_id: taskId, description }),
    status: "completed",
  };
}

function todoWriteTool(): ConversationItem {
  return {
    id: "todo-write",
    kind: "tool",
    toolType: "todo",
    title: "Tool: TodoWrite",
    detail: JSON.stringify({
      todos: [{ content: "canonical todo", status: "in_progress" }],
    }),
    status: "completed",
  };
}

function taskUpdateToolByTaskId(
  id: string,
  taskId: string,
  status: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskUpdate",
    title: "Taskupdate",
    detail: JSON.stringify({ taskId, status }),
    status: "completed",
  };
}

function taskUpdateToolByTaskIndex(
  id: string,
  taskIndex: number | string,
  status: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskUpdate",
    title: "Taskupdate",
    detail: JSON.stringify({ status, taskIndex }),
    status: "completed",
  };
}

function taskUpdateToolNested(
  id: string,
  taskId: string,
  status: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskUpdate",
    title: "Taskupdate",
    detail: JSON.stringify({ input: { taskId, status } }),
    status: "completed",
  };
}

function taskUpdateTool(
  id: string,
  description: string,
  status: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "taskUpdate",
    title: "Taskupdate",
    detail: JSON.stringify({ description, status }),
    status: "completed",
  };
}

describe("todoFloatingWindow", () => {
  it("uses Task Create cards as pending todos when TodoWrite data is absent", () => {
    expect(
      collectTodoItems([
        taskCreateTool("task-1", "测试项 8"),
        taskCreateTool("task-2", "测试项 9"),
      ]),
    ).toEqual([
      { content: "测试项 8", status: "pending" },
      { content: "测试项 9", status: "pending" },
    ]);
  });

  it("prefers TodoWrite data over Task Create fallback", () => {
    expect(
      collectTodoItems([
        taskCreateTool("task-1", "测试项 8"),
        todoWriteTool(),
      ]),
    ).toEqual([{ content: "canonical todo", status: "in_progress" }]);
  });

  it("applies TaskUpdate status changes to TaskCreate items", () => {
    expect(
      collectTodoItems([
        taskCreateTool("tc-1", "任务 A"),
        taskCreateTool("tc-2", "任务 B"),
        taskUpdateTool("tu-1", "任务 A", "completed"),
      ]),
    ).toEqual([
      { content: "任务 A", status: "completed" },
      { content: "任务 B", status: "pending" },
    ]);
  });

  it("handles multiple TaskUpdate calls", () => {
    expect(
      collectTodoItems([
        taskCreateTool("tc-1", "任务 A"),
        taskCreateTool("tc-2", "任务 B"),
        taskCreateTool("tc-3", "任务 C"),
        taskUpdateTool("tu-1", "任务 A", "completed"),
        taskUpdateTool("tu-2", "任务 B", "completed"),
      ]),
    ).toEqual([
      { content: "任务 A", status: "completed" },
      { content: "任务 B", status: "completed" },
      { content: "任务 C", status: "pending" },
    ]);
  });

  it("matches TaskUpdate to TaskCreate by task id when description is absent", () => {
    expect(
      collectTodoItems([
        taskCreateToolWithTaskId("tc-1", "task-a", "测试任务A的描述"),
        taskCreateToolWithTaskId("tc-2", "task-b", "测试任务B的描述"),
        taskCreateToolWithTaskId("tc-3", "task-c", "测试任务C的描述"),
        taskCreateToolWithTaskId("tc-4", "task-d", "测试任务D的描述"),
        taskUpdateToolByTaskId("tu-1", "task-a", "completed"),
        taskUpdateToolByTaskId("tu-2", "task-b", "completed"),
        taskUpdateToolByTaskId("tu-3", "task-c", "completed"),
        taskUpdateToolByTaskId("tu-4", "task-d", "completed"),
      ]),
    ).toEqual([
      { content: "测试任务A的描述", status: "completed" },
      { content: "测试任务B的描述", status: "completed" },
      { content: "测试任务C的描述", status: "completed" },
      { content: "测试任务D的描述", status: "completed" },
    ]);
  });

  it("matches TaskUpdate to TaskCreate by zero-based task index", () => {
    expect(
      collectTodoItems([
        taskCreateTool("tc-1", "Test TodoFloatingWindow component rendering"),
        taskCreateTool("tc-2", "Test useTodoFloatingState hook state management"),
        taskCreateTool("tc-3", "Test todoFloatingWindow utility functions"),
        taskCreateTool("tc-4", "Test Messages and status panel integration"),
        taskUpdateToolByTaskIndex("tu-1", 0, "completed"),
        taskUpdateToolByTaskIndex("tu-2", 1, "completed"),
        taskUpdateToolByTaskIndex("tu-3", "2", "completed"),
        taskUpdateToolByTaskIndex("tu-4", 3, "completed"),
      ]),
    ).toEqual([
      { content: "Test TodoFloatingWindow component rendering", status: "completed" },
      { content: "Test useTodoFloatingState hook state management", status: "completed" },
      { content: "Test todoFloatingWindow utility functions", status: "completed" },
      { content: "Test Messages and status panel integration", status: "completed" },
    ]);
  });

  it("handles TaskUpdate with nested input structure", () => {
    expect(
      collectTodoItems([
        taskCreateToolWithTaskId("tc-1", "task-a", "读取目标文件内容"),
        taskCreateToolWithTaskId("tc-2", "task-b", "执行必要的代码修改"),
        taskCreateToolWithTaskId("tc-3", "task-c", "验证修改结果是否符合预期"),
        taskCreateToolWithTaskId("tc-4", "task-d", "记录变更并完成收尾工作"),
        taskUpdateToolNested("tu-1", "task-a", "completed"),
        taskUpdateToolNested("tu-2", "task-b", "completed"),
        taskUpdateToolNested("tu-3", "task-c", "completed"),
      ]),
    ).toEqual([
      { content: "读取目标文件内容", status: "completed" },
      { content: "执行必要的代码修改", status: "completed" },
      { content: "验证修改结果是否符合预期", status: "completed" },
      { content: "记录变更并完成收尾工作", status: "pending" },
    ]);
  });

  it("matches TaskUpdate by generated sequential ID when TaskCreate lacks explicit IDs", () => {
    expect(
      collectTodoItems([
        taskCreateTool("tc-1", "测试 TaskCreate 工具能否正常创建任务"),
        taskCreateTool("tc-2", "测试 TaskUpdate 能否正常更新状态"),
        taskCreateTool("tc-3", "测试多个任务并行创建"),
        taskCreateTool("tc-4", "测试完成状态标记"),
        taskUpdateToolByTaskId("tu-1", "1", "completed"),
        taskUpdateToolByTaskId("tu-2", "2", "completed"),
        taskUpdateToolByTaskId("tu-3", "3", "completed"),
        taskUpdateToolByTaskId("tu-4", "4", "completed"),
      ]),
    ).toEqual([
      { content: "测试 TaskCreate 工具能否正常创建任务", status: "completed" },
      { content: "测试 TaskUpdate 能否正常更新状态", status: "completed" },
      { content: "测试多个任务并行创建", status: "completed" },
      { content: "测试完成状态标记", status: "completed" },
    ]);
  });

  it("ignores TaskUpdate when no matching TaskCreate exists", () => {
    expect(
      collectTodoItems([
        taskCreateTool("tc-1", "任务 A"),
        taskUpdateTool("tu-1", "不存在的任务", "completed"),
      ]),
    ).toEqual([{ content: "任务 A", status: "pending" }]);
  });

  it("defaults to the top-right position", () => {
    expect(resolveDefaultTodoFloatingPosition(1024, 768)).toEqual({
      x: 728,
      y: 16,
    });
  });
});
