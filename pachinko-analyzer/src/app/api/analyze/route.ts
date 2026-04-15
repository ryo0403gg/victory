import { NextResponse } from "next/server";

type IncomeRecord = {
  date: string;
  shop: string;
  machine: string;
  investment: number;
  payout: number;
  spins: number;
  memo: string;
  tags: string[];
};

type HallDataRow = {
  date: string;
  shop: string;
  machine: string;
  machineNo: string;
  jackpots: number;
  firstHits: number;
  totalSpins: number;
  estimatedRotation: number;
  note: string;
};

type Summary = {
  totalInvestment: number;
  totalPayout: number;
  totalBalance: number;
  winRate: number;
  averageRotation: number;
  topTag: string;
  bestShop: [string, number];
  bestMachineByHall: HallDataRow | null;
};

type PublicSnapshot = {
  storeName: string;
  latestResult: {
    date: string;
    averageGames: number;
    winRate: string;
    topMachines: Array<{
      machine: string;
      averageDiff: number | null;
      averageGames: number;
      winRate: string;
    }>;
  };
  previousResult: {
    date: string;
    averageGames: number;
    winRate: string;
    topMachines: Array<{
      machine: string;
      averageDiff: number | null;
      averageGames: number;
      winRate: string;
    }>;
  };
  upcomingEventDays: string[];
};

function createFallbackAnalysis(
  summary: Summary,
  records: IncomeRecord[],
  hallData: HallDataRow[],
  publicSnapshot?: PublicSnapshot | null
) {
  const latestRecord = records[0];
  const bestHallMachine = summary.bestMachineByHall;
  const negativeMachines = records
    .filter((record) => record.payout - record.investment < 0)
    .map((record) => record.machine);

  const lines = [
    `総収支は ${summary.totalBalance.toLocaleString("ja-JP")} 円、勝率は ${summary.winRate.toFixed(1)}% です。`,
    `もっとも結果が出ている店舗は ${summary.bestShop[0]} で、累計 ${summary.bestShop[1].toLocaleString("ja-JP")} 円です。`,
    `頻出タグは「${summary.topTag}」です。このタグの日の動きを深掘りすると、再現性のある狙い方が見えやすいです。`,
  ];

  if (bestHallMachine) {
    lines.push(
      `ホール実測では ${bestHallMachine.shop} の ${bestHallMachine.machine} ${bestHallMachine.machineNo}番台が ${bestHallMachine.estimatedRotation.toFixed(1)}回/k と最も良く、次回の優先候補です。`
    );
  }

  if (latestRecord) {
    lines.push(
      `直近の収支記録は ${latestRecord.shop} / ${latestRecord.machine} で、タグは ${latestRecord.tags.join("、") || "なし"} です。`
    );
  }

  if (negativeMachines.length > 0) {
    lines.push(
      `負けが続いた機種は ${Array.from(new Set(negativeMachines)).join("、")} です。実測回転率と並べて、見切り基準を先に決めるのが安全です。`
    );
  }

  if (hallData.length > 0) {
    const highRotationRows = hallData.filter((row) => row.estimatedRotation >= summary.averageRotation);
    lines.push(
      `実測データ ${hallData.length} 件のうち、平均以上の回転率は ${highRotationRows.length} 件でした。高回転の店舗とタグの重なりを次回の仮説に使えます。`
    );
  }

  if (publicSnapshot) {
    const topMachine = publicSnapshot.latestResult.topMachines[0];
    lines.push(
      `${publicSnapshot.storeName} の公開集計では ${publicSnapshot.latestResult.date} の平均G数が ${publicSnapshot.latestResult.averageGames.toLocaleString("ja-JP")}、勝率は ${publicSnapshot.latestResult.winRate} でした。`
    );

    if (topMachine) {
      lines.push(
        `公開上位機種は ${topMachine.machine} で、平均差枚 ${topMachine.averageDiff?.toLocaleString("ja-JP") ?? "-"}、平均G数 ${topMachine.averageGames.toLocaleString("ja-JP")} です。`
      );
    }

    if (publicSnapshot.upcomingEventDays.length > 0) {
      lines.push(
        `公開上の注目日は ${publicSnapshot.upcomingEventDays.join("、")} です。次回はこの日の実測値を優先して取りにいくと判断精度が上がります。`
      );
    }
  }

  lines.push("AIキーを設定すると、ここを OpenAI による自然文の深い分析に切り替えられます。");

  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      summary: Summary;
      records: IncomeRecord[];
      hallData: HallDataRow[];
      publicSnapshot?: PublicSnapshot | null;
    };

    const { summary, records, hallData, publicSnapshot } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        message: createFallbackAnalysis(summary, records, hallData, publicSnapshot),
      });
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

    const prompt = [
      "あなたはパチンコの実戦データを冷静に分析するアナリストです。",
      "勝利保証はせず、観測されたデータから仮説と次回の確認ポイントだけを日本語で簡潔に出してください。",
      "出力は次の3項目に分けてください: 1. 全体評価 2. 次回の狙い方 3. 注意点",
      "",
      `summary: ${JSON.stringify(summary)}`,
      `records: ${JSON.stringify(records)}`,
      `hallData: ${JSON.stringify(hallData)}`,
      `publicSnapshot: ${JSON.stringify(publicSnapshot)}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          message: `OpenAI API 呼び出しに失敗しました。\n${errorText}`,
        },
        { status: 500 }
      );
    }

    const data = (await response.json()) as {
      output_text?: string;
    };

    return NextResponse.json({
      message:
        data.output_text ??
        createFallbackAnalysis(summary, records, hallData, publicSnapshot),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "分析処理に失敗しました。",
      },
      { status: 500 }
    );
  }
}
