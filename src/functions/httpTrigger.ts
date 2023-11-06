import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Client } from "@microsoft/microsoft-graph-client";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";

async function getGraphClient() {
  // サービスプリンシパルのアプリケーションID
  const clientId = process.env.AZURE_CLIENT_ID;
  // サービスプリンシパルのシークレット
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  // Azure ADのテナントID
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

  const name = request.query.get("name") || (await request.text()) || "world";

  return { body: `Hello, ${name}!` };
}

app.http("httpTrigger", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: httpTrigger,
});
