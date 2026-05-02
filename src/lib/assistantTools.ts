import { Type } from "@google/genai";

export const tools = [
  {
    functionDeclarations: [
      {
        name: "getTasks",
        description: "Retrieves the user's current task list and study schedule.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: "addTask",
        description: "Adds a new task to the user's study schedule.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The title of the task.",
            },
            course: {
              type: Type.STRING,
              description: "The course this task belongs to (e.g. CS101, Algorithms, etc.)",
            },
            estimatedMinutes: {
              type: Type.NUMBER,
              description: "Estimated time to complete this task in minutes.",
            },
          },
          required: ["title", "course", "estimatedMinutes"],
        },
      },
      {
        name: "setFocusMode",
        description: "Starts a focus session (pomodoro) for a specific task.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: "The ID of the task to focus on.",
            },
            durationMinutes: {
              type: Type.NUMBER,
              description: "The duration of the focus block in minutes (usually 25).",
            },
          },
          required: ["taskId", "durationMinutes"],
        },
      },
      {
        name: "syncWithMCP",
        description: "Mocks synchronization with external MCP connected apps (like Calendar, Notion, VSCode) and updates the local state.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: "The name of the app to sync with (e.g., 'Calendar', 'VSCode').",
            },
          },
          required: ["appName"],
        },
      }
    ],
  },
];
