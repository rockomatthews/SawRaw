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
  MenuItem,
  Chip
} from "@mui/material";
import { supabaseClient } from "../lib/supabaseClient";

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
  const [session, setSession] = useState(null);
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
  const [lastVideoId, setLastVideoId] = useState("");
  const [videoStatus, setVideoStatus] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");

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
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadSubscription = async () => {
      if (!session?.access_token) {
        setSubscriptionActive(false);
        return;
      }
      const res = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setSubscriptionActive(Boolean(data.active));
    };
    loadSubscription();
  }, [session?.access_token]);

  const signIn = async () => {
    if (!authEmail.trim()) return;
    await supabaseClient.auth.signInWithOtp({ email: authEmail.trim() });
    setOutput("Check your email for the sign-in link.");
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setSession(null);
    setSubscriptionActive(false);
  };

  const openCheckout = async () => {
    if (!session?.access_token) {
      setOutput("Sign in to subscribe.");
      return;
    }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setOutput(JSON.stringify(data, null, 2));
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setOutput("Prompt is required.");
      return;
    }

    setLoading(true);
    setOutput("Submitting...");

    try {
      let res;
      if (referenceFile) {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("size", size);
        form.append("seconds", seconds);
        if (referenceUrl.trim()) {
          form.append("input_reference_url", referenceUrl.trim());
        }
        form.append("input_reference_file", referenceFile);

        res = await fetch("/api/generate", {
          method: "POST",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
          body: form
        });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {})
          },
          body: JSON.stringify({
            prompt,
            size,
            seconds,
            input_reference_url: referenceUrl.trim() || undefined
          })
        });
      }

      const data = await res.json();
      setLastVideoId(data.id || "");
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setOutput(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runVariant = async (variant) => {
    const fullPrompt = `${prompt}\n\nVariant: ${variant}`;
    if (referenceFile) {
      const form = new FormData();
      form.append("prompt", fullPrompt);
      form.append("size", size);
      form.append("seconds", seconds);
      if (referenceUrl.trim()) {
        form.append("input_reference_url", referenceUrl.trim());
      }
      form.append("input_reference_file", referenceFile);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
        body: form
      });
      const data = await res.json();
      return { ok: res.ok, data };
    }

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {})
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        size,
        seconds,
        input_reference_url: referenceUrl.trim() || undefined
      })
    });
    const data = await res.json();
    return { ok: res.ok, data };
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
        response: null
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
        setBatchResults((prev) =>
          prev.map((item, i) =>
            i === index
              ? {
                  ...item,
                  status: result.ok ? "success" : "error",
                  response: result.ok ? result.data : { error: result.data }
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

  const retryVariant = async (index) => {
    const item = batchResults[index];
    if (!item) return;

    setBatchResults((prev) =>
      prev.map((row, i) => (i === index ? { ...row, status: "running" } : row))
    );

    try {
      const result = await runVariant(item.variant);
      setBatchResults((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                status: result.ok ? "success" : "error",
                response: result.ok ? result.data : { error: result.data }
              }
            : row
        )
      );
      setOutput(JSON.stringify(result.ok ? result.data : result.data, null, 2));
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

  const fetchStatus = async () => {
    if (!lastVideoId) {
      setOutput("No video id to check.");
      return;
    }
    const res = await fetch(`/api/videos/${lastVideoId}/status`, {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined
    });
    const data = await res.json();
    setVideoStatus(data);
    setOutput(JSON.stringify(data, null, 2));
  };

  const downloadVideo = async () => {
    if (!lastVideoId) {
      setOutput("No video id to download.");
      return;
    }
    const res = await fetch(`/api/videos/${lastVideoId}/content`, {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined
    });
    if (!res.ok) {
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
      return;
    }
    const blob = await res.blob();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
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
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Typography variant="h6">Account</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {session?.user?.email || "Not signed in"}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} sx={{ textAlign: { xs: "left", sm: "right" } }}>
            <Chip
              label={subscriptionActive ? "Subscribed" : "Free tier"}
              color={subscriptionActive ? "success" : "default"}
              sx={{ mr: 1 }}
            />
            {session ? (
              <Button variant="outlined" onClick={signOut}>
                Sign out
              </Button>
            ) : null}
          </Grid>
          {!session ? (
            <>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button variant="contained" onClick={signIn} fullWidth>
                  Send Magic Link
                </Button>
              </Grid>
            </>
          ) : (
            <Grid item xs={12}>
              <Button variant="contained" onClick={openCheckout}>
                Subscribe (Remove Watermark)
              </Button>
            </Grid>
          )}
        </Grid>
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
                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setOutput(
                            JSON.stringify(item.response || {}, null, 2)
                          )
                        }
                      >
                        Show Response
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => retryVariant(index)}
                        disabled={batchRunning || loading}
                      >
                        Retry
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Latest Video
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Free tier downloads are watermarked.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <Button variant="outlined" onClick={fetchStatus}>
            Check Status
          </Button>
          <Button variant="contained" onClick={downloadVideo}>
            Download / Preview
          </Button>
        </Box>
        {lastVideoId ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Video ID: {lastVideoId}
          </Typography>
        ) : null}
        {videoStatus ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Status: {videoStatus.status || "unknown"}
          </Typography>
        ) : null}
        {videoUrl ? (
          <Box sx={{ mt: 2 }}>
            <Box
              component="video"
              src={videoUrl}
              controls
              sx={{ width: "100%", borderRadius: 2 }}
            />
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
