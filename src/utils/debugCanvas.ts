// Petit utilitaire zéro-dépendance pour diagnostiquer l’aire de jeu <canvas>

export type DiagLevel = "ok" | "warn" | "error";
export type Diag = { level: DiagLevel; code: string; detail?: string };

export function attachDebugOverlay(host: HTMLElement) {
  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "absolute",
    inset: "8px auto auto 8px",
    maxWidth: "80%",
    zIndex: "99999",
    padding: "6px 8px",
    font: "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "#fff",
    background: "rgba(0,0,0,.6)",
    borderRadius: "6px",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
    lineHeight: "1.25",
  } as CSSStyleDeclaration);
  host.appendChild(box);

  const push = (level: DiagLevel, msg: string) => {
    const dot =
      level === "ok" ? "🟢" : level === "warn" ? "🟠" : "🔴";
    box.textContent = (box.textContent || "") + `${dot} ${msg}\n`;
    const fn = level === "ok" ? console.log : level === "warn" ? console.warn : console.error;
    fn("[MiniGame]", msg);
  };

  return {
    ok: (m: string) => push("ok", m),
    warn: (m: string) => push("warn", m),
    error: (m: string) => push("error", m),
    destroy: () => box.remove(),
  };
}

/**
 * Vérifie tous les points bloquants et renvoie les diagnostics (+ un canvas/ctx prêt).
 * Le canvas de test est ajouté *temporairement* puis retiré.
 */
export async function diagnoseCanvas(host: HTMLElement): Promise<{
  diags: Diag[];
  canvas?: HTMLCanvasElement;
  ctx2d?: CanvasRenderingContext2D;
}> {
  const diags: Diag[] = [];

  if (!host) {
    diags.push({ level: "error", code: "host:null", detail: "hostRef.current est null" });
    return { diags };
  }

  // Taille visible
  const r = host.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    diags.push({
      level: "error",
      code: "host:size",
      detail: `Taille nulle (w=${r.width}, h=${r.height}). Vérifie aspect-ratio / CSS.`,
    });
    return { diags };
  } else {
    diags.push({ level: "ok", code: "host:size", detail: `${Math.round(r.width)}×${Math.round(r.height)}px` });
  }

  // Prépare un canvas de test
  const cvs = document.createElement("canvas");
  cvs.width = Math.max(2, Math.floor(r.width));
  cvs.height = Math.max(2, Math.floor(r.height));
  Object.assign(cvs.style, {
    position: "absolute",
    inset: "0",
    opacity: "0",
    pointerEvents: "none",
  } as CSSStyleDeclaration);

  // S’assure que le parent positionné existe
  const cs = window.getComputedStyle(host);
  if (cs.position === "static") {
    // pour éviter que le canvas “parte” ailleurs en absolute
    (host.style as any).position = "relative";
    diags.push({ level: "warn", code: "host:position", detail: "position:relative appliqué" });
  }

  host.appendChild(cvs);

  // Contexte 2D
  const ctx = cvs.getContext("2d");
  if (!ctx) {
    diags.push({ level: "error", code: "ctx:null", detail: "getContext('2d') a retourné null" });
    cvs.remove();
    return { diags };
  }
  diags.push({ level: "ok", code: "ctx:2d" });

  // Test de dessin (pixel check)
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, 2, 2);
  try {
    const data = ctx.getImageData(1, 1, 1, 1).data;
    const drawn = data[0] > 200 && data[1] < 50 && data[2] < 50;
    if (drawn) diags.push({ level: "ok", code: "draw:pixel" });
    else diags.push({ level: "error", code: "draw:pixel", detail: "Impossible de lire le pixel (contexte verrouillé?)" });
  } catch (e: any) {
    diags.push({ level: "error", code: "draw:imageData", detail: e?.message || String(e) });
  }

  // Test requestAnimationFrame (throttle)
  const rAFok = await new Promise<boolean>((resolve) => {
    let hit = false;
    const id = requestAnimationFrame(() => {
      hit = true;
      resolve(true);
    });
    // Sécurité si rAF est figé (certains iOS en fond / onglet non visible)
    setTimeout(() => {
      if (!hit) resolve(false);
      cancelAnimationFrame(id);
    }, 250);
  });
  if (rAFok) diags.push({ level: "ok", code: "raf:tick" });
  else diags.push({ level: "warn", code: "raf:timeout", detail: "rAF lent ou onglet peu actif → fallback timer requis" });

  // Visibilité page
  if (document.visibilityState !== "visible") {
    diags.push({ level: "warn", code: "doc:visibility", detail: document.visibilityState });
  } else {
    diags.push({ level: "ok", code: "doc:visibility" });
  }

  // On garde le canvas si tout est ok (tu peux t’en servir directement)
  // sinon on le retire pour éviter de polluer le DOM.
  const hasError = diags.some(d => d.level === "error");
  if (hasError) {
    cvs.remove();
    return { diags };
  }
  return { diags, canvas: cvs, ctx2d: ctx };
}
