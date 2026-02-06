"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
  MenuItem
} from "@mui/material";
import { supabaseClient } from "@/lib/supabase/client";

const sizes = [
  { value: "1280x720", label: "1280x720 (landscape)" },
  { value: "720x1280", label: "720x1280 (portrait)" }
];

const secondsOptions = ["4", "8", "12"];

const statusColors = {
  queued: "text.secondary",
  running: "warning.main",
  success: "success.main",
  error: "error.main"
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [lookName, setLookName] = useState("SpringLookbook");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1280x720");
  const [seconds, setSeconds] = useState("4");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceFile, setReferenceFile] = useState(null);
  const [referenceOriginalFile, setReferenceOriginalFile] = useState(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState("");
  const [referenceResizeNote, setReferenceResizeNote] = useState("");
  const [variants, setVariants] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [output, setOutput] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [singleJob, setSingleJob] = useState(null);

  const [templateStyle, setTemplateStyle] = useState("");
  const [templateCamera, setTemplateCamera] = useState("");
  const [templateLighting, setTemplateLighting] = useState("");
  const [templateWardrobe, setTemplateWardrobe] = useState("");
  const [templateSet, setTemplateSet] = useState("");
  const [templateActions, setTemplateActions] = useState("");
  const [templateAudio, setTemplateAudio] = useState("");
  const [templateMood, setTemplateMood] = useState("");

  const parseSize = (value) => {
    const [w, h] = value.split("x").map((n) => Number(n));
    return { width: w, height: h };
  };

  const resizeImageToSize = async (file, targetSize) => {
    const { width, height } = parseSize(targetSize);
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      URL.revokeObjectURL(objectUrl);
      throw new Error("Failed to resize image.");
    }
    URL.revokeObjectURL(objectUrl);

    const resizedFile = new File([blob], `reference-${targetSize}.png`, {
      type: "image/png"
    });
    const previewUrl = URL.createObjectURL(resizedFile);
    return { resizedFile, previewUrl, width, height };
  };

  const handleReferenceFileChange = async (file) => {
    if (!file) {
      setReferenceOriginalFile(null);
      setReferenceFile(null);
      if (referencePreviewUrl) {
        URL.revokeObjectURL(referencePreviewUrl);
      }
      setReferencePreviewUrl("");
      setReferenceResizeNote("");
      return;
    }

    try {
      setReferenceOriginalFile(file);
      const { resizedFile, previewUrl, width, height } = await resizeImageToSize(
        file,
        size
      );
      if (referencePreviewUrl) {
        URL.revokeObjectURL(referencePreviewUrl);
      }
      setReferenceFile(resizedFile);
      setReferencePreviewUrl(previewUrl);
      setReferenceResizeNote(`Resized to ${width}x${height} for upload.`);
    } catch (error) {
      setReferenceResizeNote(error.message || "Failed to resize image.");
    }
  };

  useEffect(() => {
    if (!referenceOriginalFile) return;
    handleReferenceFileChange(referenceOriginalFile);
  }, [size]);

  useEffect(() => {
    return () => {
      if (referencePreviewUrl) {
        URL.revokeObjectURL(referencePreviewUrl);
      }
    };
  }, [referencePreviewUrl]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setUser(data.session?.user || null);
      if (data.session?.user) {
        await fetchSubscriptionStatus();
      }
    };
    init();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          await fetchSubscriptionStatus();
        } else {
          setSubscriptionActive(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchSubscriptionStatus = async () => {
    const res = await fetch("/api/subscription/status");
    const data = await res.json();
    setSubscriptionActive(Boolean(data.active));
  };

  const handleLogin = async () => {
    if (!authEmail.trim()) {
      setOutput("Email is required.");
      return;
    }
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: authEmail.trim()
    });
    if (error) {
      setOutput(error.message);
    } else {
      setOutput("Check your email for the login link.");
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
  };

  const handleCheckout = async () => {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setOutput(data.error || "Failed to start checkout");
    }
  };

  const exportPromptPack = () => {
    const payload = {
      look_name: lookName,
      base_prompt: prompt,
      size,
      seconds,
      input_reference_url: referenceUrl || null,
      input_reference_file: referenceFile ? referenceFile.name : null,
      look_template: {
        style: templateStyle,
        camera: templateCamera,
        lighting: templateLighting,
        wardrobe: templateWardrobe,
        set_dressing: templateSet,
        actions: templateActions
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        audio: templateAudio,
        mood: templateMood
      },
      variants: variants
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      generated_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lookName || "prompt-pack"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createVideoJob = async (jobPrompt) => {
    if (referenceFile) {
      const form = new FormData();
      form.append("prompt", jobPrompt);
      form.append("size", size);
      form.append("seconds", seconds);
      if (referenceUrl.trim()) {
        form.append("input_reference_url", referenceUrl.trim());
      }
      form.append("input_reference_file", referenceFile);

      const res = await fetch("/api/videos/create", {
        method: "POST",
        body: form
      });
      const data = await res.json();
      return { ok: res.ok, data };
    }

    const res = await fetch("/api/videos/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: jobPrompt,
        size,
        seconds,
        input_reference_url: referenceUrl.trim() || undefined
      })
    });
    const data = await res.json();
    return { ok: res.ok, data };
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setOutput("Prompt is required.");
      return;
    }

    setLoading(true);
    setOutput("Submitting...");

    try {
      const result = await createVideoJob(prompt);
      if (!result.ok) {
        setOutput(JSON.stringify(result.data, null, 2));
        return;
      }
      setSingleJob({
        id: result.data.id,
        status: result.data.status,
        watermarkRequired: result.data.watermark_required,
        outputUrl: null
      });
      setOutput(JSON.stringify(result.data, null, 2));
    } catch (err) {
      setOutput(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runVariant = async (variant) => {
    const fullPrompt = `${prompt}\n\nVariant: ${variant}`;
    return createVideoJob(fullPrompt);
  };

  const handleBatch = async () => {
    const variantList = variants
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    if (!prompt.trim()) {
      setOutput("Base prompt is required.");
      return;
    }
    if (variantList.length === 0) {
      setOutput("Add at least one variant line.");
      return;
    }

    setBatchRunning(true);
    setOutput("Submitting batch...");
    setBatchResults(
      variantList.map((variant) => ({
        variant,
        status: "queued",
        videoId: null,
        outputUrl: null
      }))
    );

    try {
      for (let index = 0; index < variantList.length; index += 1) {
        const variant = variantList[index];
        setBatchResults((prev) =>
          prev.map((item, i) =>
            i === index ? { ...item, status: "running" } : item
          )
        );

        const result = await runVariant(variant);
        if (!result.ok) {
          setBatchResults((prev) =>
            prev.map((item, i) =>
              i === index
                ? {
                    ...item,
                    status: "error",
                    response: result.data
                  }
                : item
            )
          );
          setOutput(JSON.stringify(result.data, null, 2));
          continue;
        }
        setBatchResults((prev) =>
          prev.map((item, i) =>
            i === index
              ? {
                  ...item,
                  status: "queued",
                  videoId: result.data.id,
                  watermarkRequired: result.data.watermark_required
                }
              : item
          )
        );
        setOutput(JSON.stringify(result.data, null, 2));
      }
    } catch (err) {
      setOutput(err.message || "Unknown error");
    } finally {
      setBatchRunning(false);
    }
  };

  const checkStatus = async (videoId) => {
    if (!videoId) return null;
    const res = await fetch(`/api/videos/status?id=${videoId}`);
    const data = await res.json();
    return { ok: res.ok, data };
  };

  const checkSingleStatus = async () => {
    if (!singleJob?.id) return;
    const result = await checkStatus(singleJob.id);
    if (!result.ok) {
      setOutput(JSON.stringify(result.data, null, 2));
      return;
    }
    setSingleJob((prev) => ({
      ...prev,
      status: result.data.status,
      outputUrl: result.data.output_url || prev.outputUrl
    }));
    setOutput(JSON.stringify(result.data, null, 2));
  };

  const checkVariantStatus = async (index) => {
    const item = batchResults[index];
    if (!item?.videoId) return;
    const result = await checkStatus(item.videoId);
    if (!result.ok) {
      setOutput(JSON.stringify(result.data, null, 2));
      return;
    }
    setBatchResults((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              status: result.data.status || row.status,
              outputUrl: result.data.output_url || row.outputUrl
            }
          : row
      )
    );
    setOutput(JSON.stringify(result.data, null, 2));
  };

  const checkAllVariants = async () => {
    for (let i = 0; i < batchResults.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await checkVariantStatus(i);
    }
  };

  const retryVariant = async (index) => {
    const item = batchResults[index];
    if (!item) return;

    setBatchResults((prev) =>
      prev.map((row, i) => (i === index ? { ...row, status: "running" } : row))
    );

    try {
      const result = await runVariant(item.variant);
      if (!result.ok) {
        setBatchResults((prev) =>
          prev.map((row, i) =>
            i === index
              ? {
                  ...row,
                  status: "error",
                  response: result.data
                }
              : row
          )
        );
        setOutput(JSON.stringify(result.data, null, 2));
        return;
      }
      setBatchResults((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                status: "queued",
                videoId: result.data.id,
                outputUrl: null,
                watermarkRequired: result.data.watermark_required
              }
            : row
        )
      );
      setOutput(JSON.stringify(result.data, null, 2));
    } catch (err) {
      setBatchResults((prev) =>
        prev.map((row, i) =>
          i === index
            ? { ...row, status: "error", response: { error: err.message } }
            : row
        )
      );
    }
  };

  const buildPromptFromTemplate = () => {
    const actionLines = templateActions
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
    const actionBlock = actionLines.length
      ? actionLines.map((line) => `- ${line}`).join("\n")
      : "";

    const blocks = [
      templateStyle && `Style: ${templateStyle}`,
      templateMood && `Mood: ${templateMood}`,
      templateSet && `Set: ${templateSet}`,
      templateWardrobe && `Wardrobe: ${templateWardrobe}`,
      templateCamera && `Camera: ${templateCamera}`,
      templateLighting && `Lighting: ${templateLighting}`,
      actionBlock && `Actions:\n${actionBlock}`,
      templateAudio && `Audio: ${templateAudio}`
    ].filter(Boolean);

    setPrompt(blocks.join("\n"));
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" gutterBottom>
        Continuity Studio MVP
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Generate consistent Sora 2 clips, export prompt packs, and run look-system
        batch variants.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Account + Billing
        </Typography>
        {user ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2">Signed in as {user.email}</Typography>
            <Typography variant="body2">
              Subscription: {subscriptionActive ? "Active" : "Not active"}
            </Typography>
            {!subscriptionActive ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Non-subscribers receive watermarked videos.
              </Typography>
            ) : null}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
              <Button variant="contained" onClick={handleCheckout}>
                Upgrade Subscription
              </Button>
              <Button variant="outlined" onClick={handleLogout}>
                Log out
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <TextField
              label="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              size="small"
            />
            <Button variant="contained" onClick={handleLogin}>
              Send Magic Link
            </Button>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Look System Name"
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              fullWidth
            >
              {sizes.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Seconds"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              fullWidth
            >
              {secondsOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Base Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              fullWidth
              multiline
              minRows={5}
              placeholder="Describe the shot, wardrobe, lighting, camera, and action."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Input Reference URL (optional)"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              fullWidth
              placeholder="https://..."
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Button variant="outlined" component="label">
                Upload Reference Image
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    handleReferenceFileChange(e.target.files?.[0] || null)
                  }
                />
              </Button>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {referenceFile ? referenceFile.name : "No file selected"}
              </Typography>
            </Box>
            {referenceResizeNote ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {referenceResizeNote}
              </Typography>
            ) : null}
            {referencePreviewUrl ? (
              <Box
                component="img"
                src={referencePreviewUrl}
                alt="Reference preview"
                sx={{
                  mt: 2,
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "contain",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider"
                }}
              />
            ) : null}
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button variant="contained" onClick={handleGenerate} disabled={loading}>
            Generate Single Clip
          </Button>
          <Button variant="outlined" onClick={exportPromptPack} disabled={loading}>
            Export Prompt Pack JSON
          </Button>
        </Box>
        {singleJob ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              Job ID: {singleJob.id} | Status: {singleJob.status}
            </Typography>
            {singleJob.watermarkRequired ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Watermark required for this job.
              </Typography>
            ) : null}
            <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button variant="outlined" onClick={checkSingleStatus}>
                Check Status
              </Button>
              {singleJob.outputUrl ? (
                <Button
                  variant="contained"
                  component="a"
                  href={singleJob.outputUrl}
                  target="_blank"
                >
                  Download
                </Button>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Look System Template Builder
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Fill the fields and build a structured base prompt.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Style"
              value={templateStyle}
              onChange={(e) => setTemplateStyle(e.target.value)}
              fullWidth
              placeholder="e.g., 35mm film, warm halation, soft grain"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Camera"
              value={templateCamera}
              onChange={(e) => setTemplateCamera(e.target.value)}
              fullWidth
              placeholder="e.g., medium close-up, slow push-in"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Lighting"
              value={templateLighting}
              onChange={(e) => setTemplateLighting(e.target.value)}
              fullWidth
              placeholder="e.g., soft key, warm fill, cool rim"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Wardrobe"
              value={templateWardrobe}
              onChange={(e) => setTemplateWardrobe(e.target.value)}
              fullWidth
              placeholder="e.g., navy trench, cream scarf"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Set Dressing"
              value={templateSet}
              onChange={(e) => setTemplateSet(e.target.value)}
              fullWidth
              placeholder="e.g., minimalist loft, amber props"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Actions (one per line)"
              value={templateActions}
              onChange={(e) => setTemplateActions(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder="e.g., model turns toward window&#10;she lifts the coat collar"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Audio"
              value={templateAudio}
              onChange={(e) => setTemplateAudio(e.target.value)}
              fullWidth
              placeholder="e.g., soft room tone, fabric rustle"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Mood"
              value={templateMood}
              onChange={(e) => setTemplateMood(e.target.value)}
              fullWidth
              placeholder="e.g., calm, refined, cinematic"
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={buildPromptFromTemplate}>
            Build Prompt from Template
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Look System Batch Runner
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Enter one variant instruction per line. Each variant is appended to the base
          prompt as a single change.
        </Typography>
        <TextField
          label="Variant Instructions"
          value={variants}
          onChange={(e) => setVariants(e.target.value)}
          fullWidth
          multiline
          minRows={5}
          placeholder="Example: change palette to teal/amber&#10;Example: swap props to winter accessories"
        />
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleBatch}
            disabled={batchRunning || loading}
          >
            Run Batch Variants
          </Button>
          {batchResults.length ? (
            <Button sx={{ ml: 2 }} variant="outlined" onClick={checkAllVariants}>
              Check All Status
            </Button>
          ) : null}
        </Box>
        {batchResults.length ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Variant Status
            </Typography>
            <Grid container spacing={2}>
              {batchResults.map((item, index) => (
                <Grid item xs={12} key={`${item.variant}-${index}`}>
                  <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                    <Typography variant="body1">{item.variant}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: statusColors[item.status] || "text.secondary" }}
                    >
                      Status: {item.status}
                    </Typography>
                    {item.videoId ? (
                      <Typography variant="caption" sx={{ display: "block" }}>
                        Job ID: {item.videoId}
                      </Typography>
                    ) : null}
                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => checkVariantStatus(index)}
                      >
                        Check Status
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => retryVariant(index)}
                        disabled={batchRunning || loading}
                      >
                        Retry
                      </Button>
                      {item.outputUrl ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={item.outputUrl}
                          target="_blank"
                        >
                          Download
                        </Button>
                      ) : null}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Response
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box component="pre" sx={{ whiteSpace: "pre-wrap", m: 0 }}>
          {output}
        </Box>
      </Paper>
    </Container>
  );
}
