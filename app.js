import { analyzeText } from "./engine/analyzer.js";
import { evaluate } from "./engine/evaluator.js";

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
	  <div v-if="result" :class="['result', resultClass]">
		{{ result }}
	  </div>

	  <div class="stats" v-if="result">
		スコア: {{ score }} / ヒット: {{ hits }}
	  </div>
		<div v-if="Object.keys(categoryScore).length" class="stats">
		  <p>カテゴリ別スコア:</p>
		  <ul>
		    <li v-for="(value, key) in categoryScore" :key="key">
		      {{ key }} : {{ value.toFixed(2) }}
		    </li>
		  </ul>
		</div>
	  <button @click="runEvaluation">テスト評価</button>
		<div v-if="evaluation" class="stats">
		  <p>📊 評価結果</p>
		  <ul>
		    <li>Accuracy: {{ (evaluation.accuracy * 100).toFixed(2) }}%</li>
		    <li>Precision: {{ (evaluation.precision * 100).toFixed(2) }}%</li>
		    <li>Recall: {{ (evaluation.recall * 100).toFixed(2) }}%</li>
		  </ul>
		
		  <p>Confusion Matrix</p>
		  <ul>
		    <li>TP: {{ evaluation.confusion.tp }}</li>
		    <li>TN: {{ evaluation.confusion.tn }}</li>
		    <li>FP: {{ evaluation.confusion.fp }}</li>
		    <li>FN: {{ evaluation.confusion.fn }}</li>
		  </ul>
		</div>
		<div v-if="evaluation" class="stats">
		  <p>❌ 誤判定（{{ evaluation.errorCases.length }}件）</p>
		  <ul>
		    <li v-for="(r, i) in evaluation.errorCases.slice(0, 20)" :key="i">
		      <strong>{{ r.text }}</strong><br>
		      正解: {{ r.label }} / 予測: {{ r.predicted }}<br>
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
      hits: 0,
      matchedWords: [], 
      categoryScore: {},
      config: null,
	  evaluation: null,
      testset: []
    };
  },
  computed: {
    resultClass() {
      if (this.result === "ポジティブ") return "positive";
      if (this.result === "ネガティブ") return "negative";
      return "neutral";
    }
  },
  async mounted() {
    let res = await fetch("./data/config.json");
    this.config = await res.json();
	res = await fetch("./data/testset.json");
    this.testset = await res.json();
  },
  methods: {
    analyze() {
      if (!this.config) return;

      const r = analyzeText(this.text, this.config);

      this.result = r.result;
      this.score = r.score;
      this.hits = r.hits;
      this.matchedWords = r.matchedWords;
      this.categoryScore = r.categoryScore;
	},
	runEvaluation() {
	  if (!this.config || !this.testset.length) return;
	
	  this.evaluation = evaluate(this.testset, this.config);
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
