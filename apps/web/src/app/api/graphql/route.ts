import { prisma } from "@ballast/db";
import { createSchema, createYoga } from "graphql-yoga";
import { authenticateApiKey, type AuthedProject } from "@/lib/api-auth";

export const runtime = "nodejs";

interface GqlContext {
  authed: AuthedProject | null;
}

const typeDefs = /* GraphQL */ `
  type Query {
    "The project the API key belongs to."
    project: Project
  }

  type Project {
    id: ID!
    name: String!
    slug: String!
    repository: String
    preset: String!
    checkRuns(first: Int = 20, after: ID): [CheckRun!]!
  }

  type CheckRun {
    id: ID!
    status: String!
    branch: String
    commitSha: String
    score: Int!
    grade: String!
    passed: Boolean!
    blockers: Int!
    warnings: Int!
    notices: Int!
    createdAt: String!
    findings: [Finding!]!
  }

  type Finding {
    id: ID!
    ruleId: String!
    severity: String!
    category: String!
    message: String!
    file: String!
    line: Int!
  }
`;

const schema = createSchema<GqlContext>({
  typeDefs,
  resolvers: {
    Query: {
      project: (_root, _args, ctx) =>
        ctx.authed ? ctx.authed.project : null,
    },
    Project: {
      checkRuns: (
        project: { id: string },
        args: { first?: number; after?: string },
      ) =>
        prisma.checkRun.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          take: Math.min(Math.max(args.first ?? 20, 1), 100),
          ...(args.after ? { cursor: { id: args.after }, skip: 1 } : {}),
        }),
    },
    CheckRun: {
      createdAt: (run: { createdAt: Date }) => run.createdAt.toISOString(),
      findings: (run: { id: string }) =>
        prisma.finding.findMany({
          where: { checkRunId: run.id },
          orderBy: [{ file: "asc" }, { line: "asc" }],
        }),
    },
  },
});

const yoga = createYoga<GqlContext>({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  landingPage: false,
  context: async ({ request }) => ({
    authed: await authenticateApiKey(request),
  }),
});

export async function GET(request: Request): Promise<Response> {
  return yoga.fetch(request);
}

export async function POST(request: Request): Promise<Response> {
  return yoga.fetch(request);
}
