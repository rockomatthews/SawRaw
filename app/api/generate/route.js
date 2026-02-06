export const runtime = "nodejs";

const ALLOWED_SIZES = new Set(["1280x720", "720x1280"]);
const ALLOWED_SECONDS = new Set(["4", "8", "12"]);

function validateInput({ prompt, size, seconds }) {
  if (!process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is not set";
  }
  if (!prompt || typeof prompt !== "string") {
    return "prompt is required";
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

async function callSoraMultipart({
  prompt,
  size,
  seconds,
  inputReferenceFile,
  inputReferenceUrl
}) {
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(seconds));

  if (inputReferenceFile) {
    form.append("input_reference", inputReferenceFile, inputReferenceFile.name);
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

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const prompt = form.get("prompt");
      const size = form.get("size") || "1280x720";
      const seconds = form.get("seconds") || "4";
      const inputReferenceUrl = form.get("input_reference_url") || "";
      const inputReferenceFile = form.get("input_reference_file");

      const error = validateInput({ prompt, size, seconds });
      if (error) {
        return Response.json({ error }, { status: 400 });
      }

      const { response, data } = await callSoraMultipart({
        prompt,
        size,
        seconds,
        inputReferenceFile,
        inputReferenceUrl
      });

      if (!response.ok) {
        return Response.json({ error: data }, { status: response.status });
      }
      return Response.json(data);
    }

    const body = await request.json();
    const {
      prompt,
      size = "1280x720",
      seconds = "4",
      input_reference_url
    } = body || {};

    const error = validateInput({ prompt, size, seconds });
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const { response, data } = await callSoraJson({
      prompt,
      size,
      seconds,
      inputReferenceUrl: input_reference_url
    });

    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
