import { analyzeText } from "./engine/analyzer.js";
import { evaluate, LABELS } from "./engine/evaluator.js";
import { displayLabel } from "./ui/labels.js";

const TESTSETS = {
  dev: { name: "開発用セット", path: "./data/testset.json" },
  holdout: { name: "ホールドアウト", path: "./data/holdout.json" }
};

const Home = {
  template: `
    <div class="card">
      <h2>感情分析エンジン</h2>

      <textarea v-model="text" rows="4" placeholder="テキストを入力..."></textarea>

      <button @click="analyze">分析</button>
		<div v-if="matchedWords.length" class="stats">
		  <p>ヒット単語:</p>
		  <ul>
			<li v-for="m in matchedWords" :key="m.word">
			  {{ m.word }}（{{ m.category }} /
			  {{ m.base }}

			  <span v-if="m.negated">→ {{ -m.base }} 否定</span>
			  <span v-if="m.multiplier !== 1">×{{ m.multiplier }}</span>

			  = {{ m.polarity.toFixed(2) }}）
			</li>
		  </ul>
		</div>
	  <div v-if="result" :class="['result', label.cssClass]">
		{{ label.text }}
	  </div>

	  <div class="stats" v-if="result">
		判定スコア: {{ normalizedScore.toFixed(2) }}（±{{ threshold }} を超えると判定）<br>
		合計: {{ score.toFixed(2) }} ÷ √ヒット数 {{ hits }}
	  </div>
      <div class="stats" v-if="debugLabel">
        debug: {{ debugLabel }}
      </div>
		<div v-if="Object.keys(categoryScore).length" class="stats">
		  <p>カテゴリ別スコア:</p>
		  <ul>
		    <li v-for="(value, key) in categoryScore" :key="key">
		      {{ key }} : {{ value.toFixed(2) }}
		    </li>
		  </ul>
		</div>

	  <div class="eval-buttons">
	    <button v-for="(s, key) in testsets" :key="key" @click="runEvaluation(key)">
	      テスト評価（{{ s.name }}）
	    </button>
	  </div>
		<div v-if="evaluation" class="stats">
		  <p>📊 評価結果: {{ testsets[evaluationSet].name }}（{{ evaluation.total }}件）</p>
		  <p class="headline">Macro-F1: {{ pct(evaluation.macroF1) }}</p>
		  <p>Accuracy: {{ pct(evaluation.accuracy) }}</p>

		  <table>
		    <tr><th></th><th>Precision</th><th>Recall</th><th>F1</th><th>件数</th></tr>
		    <tr v-for="l in labels" :key="l">
		      <th>{{ display(l).text }}</th>
		      <td>{{ pct(evaluation.perClass[l].precision) }}</td>
		      <td>{{ pct(evaluation.perClass[l].recall) }}</td>
		      <td>{{ pct(evaluation.perClass[l].f1) }}</td>
		      <td>{{ evaluation.perClass[l].support }}</td>
		    </tr>
		  </table>

		  <p>Confusion Matrix（行: 正解 / 列: 予測）</p>
		  <table>
		    <tr><th></th><th v-for="p in labels" :key="p">{{ display(p).text }}</th></tr>
		    <tr v-for="g in labels" :key="g">
		      <th>{{ display(g).text }}</th>
		      <td v-for="p in labels" :key="p" :class="{ diag: g === p }">
		        {{ evaluation.confusion[g][p] }}
		      </td>
		    </tr>
		  </table>
		</div>
		<div v-if="evaluation" class="stats">
		  <p>❌ 誤判定（{{ evaluation.errorCases.length }}件）</p>
		  <ul>
		    <li v-for="(r, i) in evaluation.errorCases.slice(0, 20)" :key="i">
		      <strong>{{ r.text }}</strong><br>
		      正解: {{ display(r.label).text }} / 予測: {{ display(r.predicted).text }}<br>
		      score: {{ r.normalizedScore.toFixed(2) }} / hits: {{ r.hits }}
		    </li>
		  </ul>

		  <p>⚠️ ヒットなし（{{ evaluation.noHitCases.length }}件）</p>
		  <ul>
		    <li v-for="(r, i) in evaluation.noHitCases.slice(0, 20)" :key="i">
		      {{ r.text }}
		    </li>
		  </ul>
		</div>
	</div>
  `,
  data() {
    return {
      text: "",
      result: "",
      score: 0,
      normalizedScore: 0,
      threshold: 0,
      hits: 0,
      matchedWords: [],
      categoryScore: {},
      config: null,
      evaluation: null,
      evaluationSet: "",
      testsets: TESTSETS,
      testsetData: {},
      labels: LABELS,
      debugLabel: ""
    };
  },
  computed: {
    label() {
      return displayLabel(this.result);
    }
  },
  async mounted() {
    const res = await fetch("./data/config.json");
    this.config = await res.json();
  },
  methods: {
    display: displayLabel,
    pct(x) {
      return (x * 100).toFixed(1) + "%";
    },
    analyze() {
      if (!this.config) return;

      const r = analyzeText(this.text, this.config);

      this.result = r.result;
      this.score = r.score;
      this.normalizedScore = r.normalizedScore;
      this.threshold = r.threshold;
      this.hits = r.hits;
      this.matchedWords = r.matchedWords;
      this.categoryScore = r.categoryScore;
      this.debugLabel = r.debugLabel;
    },
    async runEvaluation(key) {
      if (!this.config) return;

      if (!this.testsetData[key]) {
        const res = await fetch(TESTSETS[key].path);
        this.testsetData[key] = await res.json();
      }

      this.evaluationSet = key;
      this.evaluation = evaluate(this.testsetData[key], this.config);
    }
  }
};

// Router
const routes = [
  { path: "/", component: Home }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

const app = Vue.createApp({});
app.use(router);
app.mount("#app");
