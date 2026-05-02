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
        name: "upsertWikiEntry",
        description: "Creates or updates a concept entry in the Neural Wiki knowledge base.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The name of the concept (e.g. 'Backpropagation').",
            },
            content: {
              type: Type.STRING,
              description: "Markdown formatted summary of the concept.",
            },
            relatedConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of related concept titles to link to.",
            },
            category: {
              type: Type.STRING,
              description: "Category like 'Law', 'Business', 'Math', etc.",
            }
          },
          required: ["title", "content"],
        },
      },
      {
        name: "generateRecallQuestion",
        description: "Generates an active recall question for the user based on recent learning.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
              description: "The probing question to ask the user.",
            },
            answerKey: {
              type: Type.STRING,
              description: "The correct answer or key points the user should mention.",
            },
            conceptId: {
              type: Type.STRING,
              description: "The title of the wiki concept this question relates to.",
            }
          },
          required: ["question", "answerKey"],
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
