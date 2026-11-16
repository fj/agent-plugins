# foundry-finder

A [pi](https://pi.dev) extension that finds models when pi starts and registers them as pi models. It finds the model deployments on your Azure AI Foundry resources and the Gemini models on Google Vertex AI.

You do not list models by hand. When you deploy or remove a model in Foundry, or Google adds a Gemini model to Vertex AI, the next pi session shows the change.

## Install

    pi install git:github.com/fj/jxf-agent-plugins-foundry-finder-pi

This installs the released build. The sources live in [fj/agent-plugins](https://github.com/fj/agent-plugins).

## Configure

Create `foundry-finder.json` in pi's agent directory (usually `~/.pi/agent/`). Add one entry for each Foundry resource and each Vertex AI project:

```json
{
  "resources": [
    {
      "provider": "acme-azure-foundry",
      "name": "Acme Azure Foundry",
      "endpoint": "https://acme-resource.services.ai.azure.com",
      "apiKey": "$ACME_FOUNDRY_API_KEY"
    },
    {
      "type": "vertex",
      "provider": "acme-vertex",
      "name": "Acme Vertex",
      "project": "acme-project",
      "location": "global"
    }
  ]
}
```

Fields for a Foundry resource:

| Field | Required | Meaning |
|-------|----------|---------|
| `type` | no | `foundry`. This is the default. |
| `provider` | yes | The pi provider id. Use lowercase letters, digits, and hyphens. |
| `name` | no | The display name. The default is `provider`. |
| `endpoint` | yes | The resource endpoint (`https://<resource>.services.ai.azure.com`). |
| `apiKey` | yes | The resource API key. Use `$VAR` or `${VAR}` for an environment variable, `!command` for command output, or a literal value. |

Fields for a Vertex AI project:

| Field | Required | Meaning |
|-------|----------|---------|
| `type` | yes | `vertex`. |
| `provider` | yes | The pi provider id. Use lowercase letters, digits, and hyphens. |
| `name` | no | The display name. The default is `provider`. |
| `project` | yes | The Google Cloud project id. Pi sends requests and bills usage to this project. |
| `location` | no | The Vertex AI location, for example `global` or `us-central1`. The default is `global`. |
| `accessToken` | no | The access token for discovery. It uses the same syntax as `apiKey`. The default is `!gcloud auth application-default print-access-token`. |

Each entry becomes its own pi provider, because each has its own credentials and endpoint. Select a model with:

    pi --provider acme-azure-foundry --model <deployment-name>
    pi --provider acme-vertex --model gemini-4-argon

## How it works

### Foundry

1. The extension lists the resource's deployments at `/openai/deployments` with the API key. It keeps only the deployments that are ready.
2. It sends `claude-*` models to the Foundry Anthropic Messages endpoint (`/anthropic`). It sends all other models to the OpenAI Responses endpoint (`/openai/v1`).
3. It copies the context window, output limit, cost, and thinking settings from pi's built-in model catalog. If the catalog does not have the model, it uses the same-family model with the longest shared id prefix. For example, `claude-opus-5-5` uses `claude-opus-5`.
4. It removes the Anthropic compatibility flags that Foundry does not accept: strict tool schemas and mid-conversation effort.

The extension skips a deployment that has no same-family model in the catalog. It writes a message to stderr.

### Vertex AI

1. The extension lists the Gemini models in the Vertex AI Model Garden with the access token.
2. It copies the context window, output limit, thinking settings, and input types from pi's built-in `google-vertex` catalog. It uses the same closest-model rule as for Foundry.
3. It reads token prices from a cache file, `foundry-finder-vertex-prices.json`, in pi's agent directory. The prices come from the Cloud Billing Catalog: the `Text Input - Online Predictions`, `Text Output - Online Predictions`, and `Text Input Caching Online` SKUs. It uses the `Global` SKUs for the `global` location and the `Regional` SKUs for other locations.
4. It keeps a model if pi's catalog has that exact model, or if the model has a `Text Output - Online Predictions` price. It skips the other models (for example embedding, speech, and transcription models) without a message. A price from the cache replaces the catalog price.
5. Pi sends requests through its built-in `google-vertex` API with Application Default Credentials. The extension gives each provider its own project and location, so you do not set `GOOGLE_CLOUD_PROJECT` or `GOOGLE_CLOUD_LOCATION`.

Startup does not wait for the Cloud Billing Catalog. If the cache is missing or older than 24 hours, the extension refreshes it in the background. When the refresh is done, it registers the models again with the new prices.

If there is no cache yet, the extension keeps every Gemini model that has a same-family model in the catalog, at catalog prices. The refresh then removes the models that have no chat price.

If a key or token is not set, or discovery fails, the extension writes a message to stderr and skips that resource. Pi still starts.

## Limitations

- Only Claude models and OpenAI models are supported on Foundry. Other Foundry models (for example Llama or Mistral) are skipped.
- Discovery happens once, at startup. Restart pi to see new deployments and models.
- The Model Garden does not tell which locations serve a model. Some Gemini models (for example `gemini-4-argon`) work only at `global`. Some listed models (for example `gemini-3.8-live`) do not accept normal requests and return 404.
- Vertex AI requests always use Application Default Credentials. A `GOOGLE_CLOUD_API_KEY` is not used for these providers.
- A short pi run (for example `pi --list-models`) can exit before the price refresh is done. The next longer run writes the cache.
- Gemini Decisions API models are not supported. They are not on Vertex AI, and pi has no transport for them.

## Develop

    node --test 'test/*.test.ts'

The tests use Node's built-in test runner and type stripping (Node 22.18 or later). They need no dependencies.

To build the Pi package:

    node scripts/build.ts --harness pi --out <absolute dir> --version <x.y.t>
