import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    storeName: "エスパス日拓新小岩駅前店",
    fetchedAt: "2026-04-14",
    storeUpdatedAt: "2026-04-14",
    address: "東京都葛飾区新小岩1-44-2 クッターナ新小岩ビル地下1階・1階・2階",
    access: "JR新小岩駅南口すぐ",
    pachinkoMachines: 355,
    slotMachines: 464,
    openingHours: "10:00-22:45",
    latestResult: {
      date: "2026-04-12",
      averageGames: 4391,
      winRate: "198 / 464",
      topMachines: [
        {
          machine: "L 東京喰種",
          averageDiff: 6432,
          averageGames: 7867,
          winRate: "4 / 5",
        },
        {
          machine: "スマスロ モンハンライズ",
          averageDiff: 3960,
          averageGames: 7264,
          winRate: "2 / 4",
        },
        {
          machine: "Lパチスロ ダンベル何キロ持てる？",
          averageDiff: 3420,
          averageGames: 8126,
          winRate: "3 / 4",
        },
      ],
    },
    previousResult: {
      date: "2026-04-11",
      averageGames: 4183,
      winRate: "190 / 464",
      topMachines: [
        {
          machine: "スマスロ モンハンライズ",
          averageDiff: 5121,
          averageGames: 8012,
          winRate: "3 / 4",
        },
        {
          machine: "L 東京喰種",
          averageDiff: 4714,
          averageGames: 7645,
          winRate: "4 / 5",
        },
        {
          machine: "L マギアレコード",
          averageDiff: 2876,
          averageGames: 6931,
          winRate: "2 / 3",
        },
      ],
    },
    upcomingEventDays: ["毎月7日", "毎月17日", "毎月27日"],
    note:
      "現時点で公開ページから確認しやすいのは店舗基本情報とスロット系の集計結果です。台単位のリアルタイムなパチンコ実データはアプリ限定表示の導線が多く、まずは公開スナップショットを分析画面に取り込む形で実装しています。",
    sources: [
      {
        label: "DMMぱちタウン: エスパス日拓新小岩駅前店 基本情報",
        url: "https://p-town.dmm.com/shops/tokyo/720",
      },
      {
        label: "ホールガイド: エスパス新小岩駅前店 2026-04-12 結果",
        url: "https://hallguide.jp/hall/12138/results/2026-04-12",
      },
      {
        label: "ホールガイド: エスパス新小岩駅前店 2026-04-11 結果",
        url: "https://hallguide.jp/hall/12138/results/2026-04-11",
      },
    ],
  });
}
