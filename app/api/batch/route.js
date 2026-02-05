export const runtime = "nodejs";

const ALLOWED_SIZES = new Set(["1280x720", "720x1280"]);
const ALLOWED_SECONDS = new Set(["4", "8", "12"]);

function validateInput({ basePrompt, size, seconds, variants }) {
  if (!process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is not set";
  }
  if (!basePrompt || typeof basePrompt !== "string") {
    return "base_prompt is required";
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    return "variants must be a non-empty array";
  }
  if (!ALLOWED_SIZES.has(size)) {
    return "size must be 1280x720 or 720x1280";
  }
  if (!ALLOWED_SECONDS.has(String(seconds))) {
    return "seconds must be 4, 8, or 12";
  }
  return null;
}

async function callSoraJson({ prompt, size, seconds, inputReferenceUrl }) {
  const body = {
    model: "sora-2",
    prompt,
    size,
    seconds: String(seconds)
  };

  if (inputReferenceUrl) {
    body.input_reference = inputReferenceUrl;
  }

  const response = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return { response, data };
}

async function callSoraWithFile({
  prompt,
  size,
  seconds,
  inputReferenceUrl,
  fileBuffer,
  fileType,
  fileName
}) {
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(seconds));

  if (fileBuffer) {
    const blob = new Blob([fileBuffer], {
      type: fileType || "application/octet-stream"
    });
    form.append("input_reference", blob, fileName || "reference");
  } else if (inputReferenceUrl) {
    form.append("input_reference", inputReferenceUrl);
  }

  const response = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  const data = await response.json();
  return { response, data };
}

function buildPrompt(basePrompt, variant) {
  return `${basePrompt}\n\nVariant: ${variant}`;
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const basePrompt = form.get("base_prompt");
      const size = form.get("size") || "1280x720";
      const seconds = form.get("seconds") || "4";
      const inputReferenceUrl = form.get("input_reference_url") || "";
      const variantsRaw = form.get("variants") || "[]";
      const inputReferenceFile = form.get("input_reference_file");
      const variants = JSON.parse(variantsRaw);

      const error = validateInput({ basePrompt, size, seconds, variants });
      if (error) {
        return Response.json({ error }, { status: 400 });
      }

      let fileBuffer = null;
      let fileType = null;
      let fileName = null;
      if (inputReferenceFile) {
        fileBuffer = await inputReferenceFile.arrayBuffer();
        fileType = inputReferenceFile.type;
        fileName = inputReferenceFile.name;
      }

      const results = [];
      for (const variant of variants) {
        const prompt = buildPrompt(basePrompt, variant);
        const { response, data } = await callSoraWithFile({
          prompt,
          size,
          seconds,
          inputReferenceUrl,
          fileBuffer,
          fileType,
          fileName
        });

        results.push({
          variant,
          ok: response.ok,
          response: response.ok ? data : { error: data }
        });
      }

      return Response.json({ results });
    }

    const body = await request.json();
    const {
      base_prompt: basePrompt,
      size = "1280x720",
      seconds = "4",
      input_reference_url,
      variants = []
    } = body || {};

    const error = validateInput({ basePrompt, size, seconds, variants });
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const results = [];
    for (const variant of variants) {
      const prompt = buildPrompt(basePrompt, variant);
      const { response, data } = await callSoraJson({
        prompt,
        size,
        seconds,
        inputReferenceUrl: input_reference_url
      });

      results.push({
        variant,
        ok: response.ok,
        response: response.ok ? data : { error: data }
      });
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
