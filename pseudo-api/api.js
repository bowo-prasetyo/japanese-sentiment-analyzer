import { analyzeText } from "../engine/analyzer.js";

async function run() {
  try {
    const res = await fetch("../data/config.json");
    const config = await res.json();

    const params = new URLSearchParams(window.location.search);
    const text = params.get("text");

    // 空・空白だけの文は分析しない（「判定できません」と区別するため）
    if (!text || !text.trim()) {
      document.body.textContent = JSON.stringify({
        error: "text parameter required"
      });
      return;
    }

    const result = analyzeText(text, config);

    // ★ ここがポイント（JSONだけ出力）
    document.body.textContent = JSON.stringify(result);

  } catch (e) {
    document.body.textContent = JSON.stringify({
      error: "internal error",
      detail: e.message
    });
  }
}

run();
