import { anthropic, crawl } from "./lib.ts";
import {
  Checkbox,
  Confirm,
  Input,
  Number,
  Secret,
  Select,
  prompt as cliffyPrompt,
} from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";

export async function authFromDocs() {
    const authorisationRootPage = await prompt("Authorisation root page: ");
    if (!authorisationRootPage) {
    console.error("No authorisation root page provided");
    Deno.exit(1);
    }
    const authorisationBoundingPath = await prompt("Authorisation bounding path: ");
    const authPages = await crawl(authorisationRootPage, authorisationBoundingPath);
    console.log('===========================');
    console.log('FINISHED AUTH CRAWL!!!!!');
    console.log(`Got ${authPages.size} pages`);
    console.log('===========================');


    const apiKey = await prompt("API key: ");

    const llmAuthPrompt = [`You will receive the documentation to an API, enclosed in triple quotes (""").`,
    `Each page of documentation will be separated by the line =======.`,
    `Your job is to output a JSON object of authentication headers, with the placeholder {key} where credentials should go.`,
    `For instance, if the documentation specifies OAuth2 bearer tokens, you should output:`,
    `{"Authorization": "Bearer {key}"}`,
    `Here is the documentation: \n"""\n${Array.from(authPages).join(" / n =======/n")}\n"""`,
    `What are the auth headers? You must output only valid JSON and nothing else!`,
    ];

    const authCompletion = await anthropic(llmAuthPrompt.join("\n"));
    console.log("AUTH COMPLETION:", authCompletion.data);
    const rawHeaders: {[headerName: string]: string} = JSON.parse(authCompletion.data.trim());
    const headers = Object.fromEntries(Object.entries(rawHeaders).map(([key, value]) =>
    [key, apiKey ? value.replace("{key}", apiKey) : value]
    ));

    console.log("AUTH HEADERS:");
    return headers;
}

type AuthType = null | "api-key";
export async function authFromUserInput() {
    const authType = await Select.prompt<AuthType>({
        message: "Authentication type",
        options: [
            { name: "None", value: null },
            { name: "API Key", value: "api-key" }
        ]
    });

    if (authType === null) {
        return null;
    }

    const apiKeyType = await Select.prompt({
        message: "API key type",
        options: [
            { name: "Basic", value: "basic" },
            { name: "Bearer", value: "bearer" },
            { name: "Custom header", value: "custom-header" },
            { name: "Query parameter", value: "query-parameter" }
        ]
    });

    if (apiKeyType === "basic") {
        const username = await Secret.prompt("Username: ");
        const password = await Secret.prompt("Password: ");
        const authHeader = btoa(`${username}:${password}`);
        return { headers: { Authorization: `Basic ${authHeader}` } };
    }

    if (apiKeyType === "bearer") {
        const bearerToken = await Secret.prompt("Bearer token: ");
        return { headers: { Authorization: `Bearer ${bearerToken}` } };
    }

    if (apiKeyType === "custom-header") {
        const headerName = await Input.prompt("Header name: ");
        const headerValue = await Secret.prompt("Header value: ");
        return { headers: { [headerName]: headerValue } };
    }

    if (apiKeyType === "query-parameter") {
        const paramName = await Input.prompt("Parameter name: ");
        const paramValue = await Secret.prompt("Parameter value: ");
        return { queryParameters: { [paramName]: paramValue } };
    }
}