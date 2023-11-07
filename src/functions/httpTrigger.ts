import "isomorphic-fetch";
import {
  app,
  Exception,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Client } from "@microsoft/microsoft-graph-client";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";

async function getGraphClient() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  const applicationTokenCredentials = await loginWithServicePrincipalSecret(
    clientId,
    clientSecret,
    tenantId,
    { tokenAudience: "https://graph.microsoft.com" }
  );

  const getAccessTokenFunc = async (): Promise<string> => {
    const tokenResponse = await applicationTokenCredentials.getToken();
    return tokenResponse.accessToken;
  };

  const graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: getAccessTokenFunc,
    },
  });

  return graphClient;
}

export async function httpTrigger(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const groupId = request.query.get("groupId");
  const name = request.query.get("name");

  if (!groupId || !name) {
    return { status: 400, body: "BadRequest" };
  }

  // https://learn.microsoft.com/en-us/graph/api/group-update?view=graph-rest-1.0&tabs=http
  const graphClient = await getGraphClient();

  try {
    await graphClient.api(`/groups/${groupId}`).update({
      displayName: name,
    });
    return { status: 200, body: "OK" };
  } catch (e: any) {
    return { status: 500, body: e };
  }
}

app.http("httpTrigger", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: httpTrigger,
});
