import { analyzeText } from "./engine/analyzer.js";

let config = null;

// 初期化（JSON読み込み）
async function init() {
  const res = await fetch("./data/config.json");
  config = await res.json();

  console.log("Config loaded");
}

// ボタン押下時の処理
window.analyze = function () {
  const input = document.getElementById("input").value;

  if (!config) {
    alert("設定ファイルがまだ読み込まれていません");
    return;
  }

  const result = analyzeText(input, config);

  document.getElementById("result").innerText =
    `結果: ${result.result}
スコア: ${result.score}
ヒット数: ${result.hits}`;
};

// 初期化実行
init();
