"use client";

import { useEffect, useMemo, useState } from "react";

type SessionTag =
  | "イベント日"
  | "新台"
  | "海"
  | "リセット狙い"
  | "夕方稼働"
  | "高稼働"
  | "ボーダー超え";

type IncomeRecord = {
  id: number;
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
  id: number;
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

type PublicMachineRow = {
  machine: string;
  averageDiff: number | null;
  averageGames: number;
  winRate: string;
};

type EspaceSnapshot = {
  storeName: string;
  fetchedAt: string;
  storeUpdatedAt: string;
  address: string;
  access: string;
  pachinkoMachines: number;
  slotMachines: number;
  openingHours: string;
  latestResult: {
    date: string;
    averageGames: number;
    winRate: string;
    topMachines: PublicMachineRow[];
  };
  previousResult: {
    date: string;
    averageGames: number;
    winRate: string;
    topMachines: PublicMachineRow[];
  };
  upcomingEventDays: string[];
  note: string;
  sources: Array<{ label: string; url: string }>;
};

const presetTags: SessionTag[] = [
  "イベント日",
  "新台",
  "海",
  "リセット狙い",
  "夕方稼働",
  "高稼働",
  "ボーダー超え",
];

const initialRecords: IncomeRecord[] = [
  {
    id: 1,
    date: "2026-04-03",
    shop: "Super Hall Shinagawa",
    machine: "e北斗の拳10",
    investment: 18000,
    payout: 32500,
    spins: 812,
    memo: "夕方の空き台。22回転前後で安定。",
    tags: ["イベント日", "ボーダー超え"],
  },
  {
    id: 2,
    date: "2026-04-06",
    shop: "Maruhan Yokohama",
    machine: "PA海物語3R3",
    investment: 7000,
    payout: 11800,
    spins: 491,
    memo: "甘デジでも粘れた日。",
    tags: ["海", "高稼働"],
  },
  {
    id: 3,
    date: "2026-04-10",
    shop: "Rakuen Kawasaki",
    machine: "シン・エヴァンゲリオン",
    investment: 25000,
    payout: 9000,
    spins: 645,
    memo: "寄りは悪くないがヘソが足りない。",
    tags: ["新台"],
  },
];

const initialHallData: HallDataRow[] = [
  {
    id: 1,
    date: "2026-04-12",
    shop: "Super Hall Shinagawa",
    machine: "e北斗の拳10",
    machineNo: "412",
    jackpots: 31,
    firstHits: 8,
    totalSpins: 2694,
    estimatedRotation: 21.8,
    note: "メイン島で強め。午後からも落ちない。",
  },
  {
    id: 2,
    date: "2026-04-12",
    shop: "Super Hall Shinagawa",
    machine: "e北斗の拳10",
    machineNo: "415",
    jackpots: 27,
    firstHits: 7,
    totalSpins: 2518,
    estimatedRotation: 20.9,
    note: "朝から埋まり。終日高稼働。",
  },
  {
    id: 3,
    date: "2026-04-13",
    shop: "Maruhan Yokohama",
    machine: "PA海物語3R3",
    machineNo: "128",
    jackpots: 22,
    firstHits: 12,
    totalSpins: 1872,
    estimatedRotation: 19.4,
    note: "甘の中では扱いが良さそう。",
  },
  {
    id: 4,
    date: "2026-04-13",
    shop: "Rakuen Kawasaki",
    machine: "シン・エヴァンゲリオン",
    machineNo: "301",
    jackpots: 15,
    firstHits: 4,
    totalSpins: 2105,
    estimatedRotation: 17.1,
    note: "粗いが粘るには厳しい数字。",
  },
];

const currency = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ja-JP");

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getOrCreateDeviceId() {
  const key = "pachinko-analyzer-device-id";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export default function Home() {
  const [records, setRecords] = useState<IncomeRecord[]>(initialRecords);
  const [hallData, setHallData] = useState<HallDataRow[]>(initialHallData);
  const [deviceId, setDeviceId] = useState("");
  const [storageMode, setStorageMode] = useState<"checking" | "local" | "supabase">("checking");
  const [storageMessage, setStorageMessage] = useState("保存方法を確認しています。");
  const [syncReady, setSyncReady] = useState(false);
  const [espaceSnapshot, setEspaceSnapshot] = useState<EspaceSnapshot | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceMessage, setSourceMessage] = useState("新小岩エスパスの公開データはまだ読み込んでいません。");
  const [customTag, setCustomTag] = useState("");
  const [recordForm, setRecordForm] = useState({
    date: "2026-04-14",
    shop: "Super Hall Shinagawa",
    machine: "e北斗の拳10",
    investment: "12000",
    payout: "24000",
    spins: "620",
    memo: "",
    tags: ["イベント日"] as string[],
  });
  const [hallForm, setHallForm] = useState({
    date: "2026-04-14",
    shop: "Super Hall Shinagawa",
    machine: "e北斗の拳10",
    machineNo: "418",
    jackpots: "26",
    firstHits: "6",
    totalSpins: "2488",
    estimatedRotation: "21.3",
    note: "",
  });
  const [aiMessage, setAiMessage] = useState("AI分析を実行すると、収支、タグ、ホール実測データ、公開スナップショットをまとめて見て仮説を返します。");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const boot = async () => {
      const localRecords = window.localStorage.getItem("pachinko-analyzer-records");
      const localHallData = window.localStorage.getItem("pachinko-analyzer-hall-data");

      if (localRecords) {
        try {
          setRecords(JSON.parse(localRecords) as IncomeRecord[]);
        } catch {
          console.warn("records load failed");
        }
      }

      if (localHallData) {
        try {
          setHallData(JSON.parse(localHallData) as HallDataRow[]);
        } catch {
          console.warn("hallData load failed");
        }
      }

      const currentDeviceId = getOrCreateDeviceId();
      setDeviceId(currentDeviceId);

      try {
        const response = await fetch(`/api/storage/snapshot?deviceId=${encodeURIComponent(currentDeviceId)}`);
        const result = (await response.json()) as {
          mode: "local" | "supabase";
          records: IncomeRecord[] | null;
          hallData: HallDataRow[] | null;
          updatedAt?: string | null;
        };

        if (result.mode === "supabase") {
          setStorageMode("supabase");
          setStorageMessage(
            result.updatedAt
              ? `Supabase に保存されています。3か月を超えた古いデータは保存時に除外され、3か月以上更新されない端末データは自動削除されます。最終同期: ${result.updatedAt}`
              : "Supabase は接続済みです。初回同期前のため、まだ保存データはありません。"
          );

          if (result.records) setRecords(result.records);
          if (result.hallData) setHallData(result.hallData);
        } else {
          setStorageMode("local");
          setStorageMessage("現在はローカル保存です。Supabase の環境変数を設定すると、3か月保持のクラウド保存に切り替わります。");
        }
      } catch (error) {
        console.error(error);
        setStorageMode("local");
        setStorageMessage("同期確認に失敗したため、ローカル保存で続行しています。");
      } finally {
        setSyncReady(true);
      }
    };

    void boot();
  }, []);

  useEffect(() => {
    if (!syncReady) return;

    window.localStorage.setItem("pachinko-analyzer-records", JSON.stringify(records));
    window.localStorage.setItem("pachinko-analyzer-hall-data", JSON.stringify(hallData));

    if (!deviceId) return;

    const sync = async () => {
      try {
        const response = await fetch("/api/storage/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, records, hallData }),
        });

        const result = (await response.json()) as { mode: "local" | "supabase" };
        if (result.mode === "supabase") {
          setStorageMode("supabase");
          setStorageMessage("Supabase に同期しました。3か月より古いデータは保存対象から自動で外れます。");
        }
      } catch (error) {
        console.error(error);
      }
    };

    void sync();
  }, [deviceId, hallData, records, syncReady]);

  const summary = useMemo(() => {
    const totalInvestment = records.reduce((sum, record) => sum + record.investment, 0);
    const totalPayout = records.reduce((sum, record) => sum + record.payout, 0);
    const totalBalance = totalPayout - totalInvestment;
    const winCount = records.filter((record) => record.payout - record.investment > 0).length;
    const averageRotation = hallData.length > 0 ? hallData.reduce((sum, row) => sum + row.estimatedRotation, 0) / hallData.length : 0;
    const tagCounts = records.flatMap((record) => record.tags).reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "未設定";
    const bestShop = Object.entries(records.reduce<Record<string, number>>((acc, record) => {
      acc[record.shop] = (acc[record.shop] ?? 0) + (record.payout - record.investment);
      return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0] ?? ["未集計", 0];
    const bestMachineByHall = [...hallData].sort((a, b) => b.estimatedRotation - a.estimatedRotation)[0] ?? null;
    return {
      totalInvestment,
      totalPayout,
      totalBalance,
      winRate: records.length > 0 ? (winCount / records.length) * 100 : 0,
      averageRotation,
      topTag,
      bestShop,
      bestMachineByHall,
    };
  }, [records, hallData]);

  const machineInsights = useMemo(() => {
    return Object.values(hallData.reduce<Record<string, { machine: string; rows: number; avgRotation: number }>>((acc, row) => {
      if (!acc[row.machine]) acc[row.machine] = { machine: row.machine, rows: 0, avgRotation: 0 };
      acc[row.machine].rows += 1;
      acc[row.machine].avgRotation += row.estimatedRotation;
      return acc;
    }, {})).map((entry) => ({ ...entry, avgRotation: entry.avgRotation / entry.rows })).sort((a, b) => b.avgRotation - a.avgRotation);
  }, [hallData]);

  const handleToggleTag = (tag: string) => {
    setRecordForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
    }));
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    setRecordForm((current) => ({
      ...current,
      tags: current.tags.includes(trimmed) ? current.tags : [...current.tags, trimmed],
    }));
    setCustomTag("");
  };

  const submitRecord = () => {
    const investment = Number(recordForm.investment);
    const payout = Number(recordForm.payout);
    const spins = Number(recordForm.spins);
    if (!recordForm.date || !recordForm.shop || !recordForm.machine) return;
    setRecords((current) => [{ id: Date.now(), date: recordForm.date, shop: recordForm.shop, machine: recordForm.machine, investment, payout, spins, memo: recordForm.memo, tags: recordForm.tags }, ...current]);
    setRecordForm((current) => ({ ...current, investment: "0", payout: "0", spins: "0", memo: "", tags: [] }));
  };

  const submitHallData = () => {
    const jackpots = Number(hallForm.jackpots);
    const firstHits = Number(hallForm.firstHits);
    const totalSpins = Number(hallForm.totalSpins);
    const estimatedRotation = Number(hallForm.estimatedRotation);
    if (!hallForm.date || !hallForm.shop || !hallForm.machine || !hallForm.machineNo) return;
    setHallData((current) => [{ id: Date.now(), date: hallForm.date, shop: hallForm.shop, machine: hallForm.machine, machineNo: hallForm.machineNo, jackpots, firstHits, totalSpins, estimatedRotation, note: hallForm.note }, ...current]);
    setHallForm((current) => ({ ...current, machineNo: "", jackpots: "0", firstHits: "0", totalSpins: "0", estimatedRotation: "0", note: "" }));
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, records, hallData, publicSnapshot: espaceSnapshot }),
      });
      const result = (await response.json()) as { message?: string };
      setAiMessage(result.message ?? "AI分析の結果を取得できませんでした。");
    } catch (error) {
      console.error(error);
      setAiMessage("AI分析の呼び出しに失敗しました。");
    } finally {
      setAiLoading(false);
    }
  };

  const loadEspaceSnapshot = async () => {
    setSourceLoading(true);
    try {
      const response = await fetch("/api/halls/espace-shinkoiwa");
      const result = (await response.json()) as EspaceSnapshot;
      setEspaceSnapshot(result);
      setSourceMessage(`公開データを読み込みました。最新集計日は ${result.latestResult.date}、店舗確認日は ${result.storeUpdatedAt} です。`);
    } catch (error) {
      console.error(error);
      setSourceMessage("新小岩エスパスの公開データ取得に失敗しました。");
    } finally {
      setSourceLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.35),_transparent_24%),linear-gradient(180deg,#030712_0%,#071426_48%,#08162c_100%)] text-[#e8f1ff]">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        <header className="rounded-[2rem] border border-[#1e3a66] bg-[#081527]/90 p-6 shadow-[0_18px_48px_rgba(2,6,23,0.65)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#7dd3fc]">Pachinko Analyzer</p>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  収支入力、実データ分析、AI仮説出しを
                  <span className="block bg-[linear-gradient(90deg,#dbeafe_0%,#7dd3fc_40%,#2563eb_100%)] bg-clip-text text-transparent">ひとつの画面で回せるようにした。</span>
                </h1>
                <p className="max-w-3xl text-base leading-8 text-[#c2d7f5]">今回は、タグ付き収支記録、ホール実測、公開データ、AI分析、Supabase同期までをつないでいます。</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="総収支" value={currency.format(summary.totalBalance)} />
              <MetricCard label="勝率" value={`${summary.winRate.toFixed(1)}%`} />
              <MetricCard label="平均回転率" value={`${summary.averageRotation.toFixed(1)}回/k`} />
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-[2rem] border border-[#1f3b66] bg-[#081527]/92 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#dbeafe]">保存モード: {storageMode === "supabase" ? "Supabase" : storageMode === "local" ? "Local" : "Checking"}</p>
              <p className="mt-1 text-sm leading-7 text-[#bdd0ef]">{storageMessage}</p>
            </div>
            <p className="text-xs text-[#8fb4e4]">保持期間: 直近3か月</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Panel title="収支入力" description="実戦収支をタグ付きで記録します。タグでイベント日や狙いの振り返りができます。">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="日付"><input className={inputClass} type="date" value={recordForm.date} onChange={(e) => setRecordForm((c) => ({ ...c, date: e.target.value }))} /></Field>
                <Field label="店舗"><input className={inputClass} value={recordForm.shop} onChange={(e) => setRecordForm((c) => ({ ...c, shop: e.target.value }))} /></Field>
                <Field label="機種"><input className={inputClass} value={recordForm.machine} onChange={(e) => setRecordForm((c) => ({ ...c, machine: e.target.value }))} /></Field>
                <Field label="回転数"><input className={inputClass} type="number" value={recordForm.spins} onChange={(e) => setRecordForm((c) => ({ ...c, spins: e.target.value }))} /></Field>
                <Field label="投資"><input className={inputClass} type="number" value={recordForm.investment} onChange={(e) => setRecordForm((c) => ({ ...c, investment: e.target.value }))} /></Field>
                <Field label="回収"><input className={inputClass} type="number" value={recordForm.payout} onChange={(e) => setRecordForm((c) => ({ ...c, payout: e.target.value }))} /></Field>
              </div>
              <div className="mt-5">
                <p className="text-sm font-medium text-[#dbeafe]">タグ</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presetTags.map((tag) => (
                    <button key={tag} type="button" className={joinClasses("rounded-full border px-3 py-2 text-sm transition", recordForm.tags.includes(tag) ? "border-[#60a5fa] bg-[#14325b] text-[#eff6ff]" : "border-[#24406b] bg-[#081527] text-[#9db9df] hover:bg-[#0d203b]")} onClick={() => handleToggleTag(tag)}>{tag}</button>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input className={inputClass} placeholder="独自タグを追加" value={customTag} onChange={(e) => setCustomTag(e.target.value)} />
                  <button className={primaryButtonClass} onClick={addCustomTag} type="button">タグ追加</button>
                </div>
              </div>
              <Field className="mt-5" label="メモ"><textarea className={joinClasses(inputClass, "min-h-28 resize-none")} value={recordForm.memo} onChange={(e) => setRecordForm((c) => ({ ...c, memo: e.target.value }))} /></Field>
              <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#1f3b66] bg-[#071120] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-[#9db9df]">入力中の収支</p>
                  <p className="text-2xl font-semibold text-[#7dd3fc]">{currency.format(Number(recordForm.payout) - Number(recordForm.investment))}</p>
                </div>
                <button className={primaryButtonClass} onClick={submitRecord} type="button">収支を追加</button>
              </div>
            </Panel>

            <Panel title="収支履歴" description="タグ付き履歴を一覧で確認します。Supabase同期時は直近3か月のみ保持されます。">
              <div className="space-y-3">
                {records.map((record) => {
                  const balance = record.payout - record.investment;
                  return (
                    <div key={record.id} className="rounded-2xl border border-[#1f3b66] bg-[#071120] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <p className="text-sm text-[#9db9df]">{record.date} / {record.shop}</p>
                          <h3 className="text-xl font-semibold text-[#eff6ff]">{record.machine}</h3>
                          <p className="text-sm text-[#bfd6f8]">{record.memo}</p>
                          <div className="flex flex-wrap gap-2">{record.tags.map((tag) => <span key={tag} className="rounded-full border border-[#24508a] bg-[#102645] px-3 py-1 text-xs text-[#8bd4ff]">{tag}</span>)}</div>
                        </div>
                        <div className="grid gap-2 text-right text-sm text-[#bfd6f8]">
                          <p>投資: {currency.format(record.investment)}</p>
                          <p>回収: {currency.format(record.payout)}</p>
                          <p>回転数: {numberFormat.format(record.spins)}</p>
                          <p className="text-lg font-semibold text-[#7dd3fc]">収支: {currency.format(balance)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="ホール実測データ入力" description="店舗の実データを記録して、収支だけでは見えない強さを分析します。">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="日付"><input className={inputClass} type="date" value={hallForm.date} onChange={(e) => setHallForm((c) => ({ ...c, date: e.target.value }))} /></Field>
                <Field label="店舗"><input className={inputClass} value={hallForm.shop} onChange={(e) => setHallForm((c) => ({ ...c, shop: e.target.value }))} /></Field>
                <Field label="機種"><input className={inputClass} value={hallForm.machine} onChange={(e) => setHallForm((c) => ({ ...c, machine: e.target.value }))} /></Field>
                <Field label="台番号"><input className={inputClass} value={hallForm.machineNo} onChange={(e) => setHallForm((c) => ({ ...c, machineNo: e.target.value }))} /></Field>
                <Field label="大当たり"><input className={inputClass} type="number" value={hallForm.jackpots} onChange={(e) => setHallForm((c) => ({ ...c, jackpots: e.target.value }))} /></Field>
                <Field label="初当たり"><input className={inputClass} type="number" value={hallForm.firstHits} onChange={(e) => setHallForm((c) => ({ ...c, firstHits: e.target.value }))} /></Field>
                <Field label="総回転数"><input className={inputClass} type="number" value={hallForm.totalSpins} onChange={(e) => setHallForm((c) => ({ ...c, totalSpins: e.target.value }))} /></Field>
                <Field label="推定回転率"><input className={inputClass} type="number" step="0.1" value={hallForm.estimatedRotation} onChange={(e) => setHallForm((c) => ({ ...c, estimatedRotation: e.target.value }))} /></Field>
              </div>
              <Field className="mt-5" label="メモ"><textarea className={joinClasses(inputClass, "min-h-24 resize-none")} value={hallForm.note} onChange={(e) => setHallForm((c) => ({ ...c, note: e.target.value }))} /></Field>
              <div className="mt-5 flex justify-end"><button className={primaryButtonClass} onClick={submitHallData} type="button">実測データを追加</button></div>
            </Panel>

            <Panel title="実データ分析" description="ホール実測データから、どの店舗・機種に強さがあるかを定量的に見ます。">
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniStat label="最も強い店舗" value={String(summary.bestShop[0])} subValue={currency.format(Number(summary.bestShop[1]))} />
                <MiniStat label="頻出タグ" value={summary.topTag} subValue="狙い方の傾向" />
                <MiniStat label="平均回転率" value={`${summary.averageRotation.toFixed(1)}回/k`} subValue="ホール実測平均" />
                <MiniStat label="高回転候補" value={summary.bestMachineByHall?.machine ?? "未集計"} subValue={summary.bestMachineByHall ? `${summary.bestMachineByHall.shop} ${summary.bestMachineByHall.estimatedRotation.toFixed(1)}回/k` : "追加待ち"} />
              </div>
              <div className="mt-5 space-y-3">{machineInsights.map((item) => <div key={item.machine} className="flex items-center justify-between rounded-2xl border border-[#1f3b66] bg-[#071120] px-4 py-3"><div><p className="font-medium text-[#eff6ff]">{item.machine}</p><p className="text-sm text-[#a9c3e7]">実測 {item.rows} 件</p></div><p className="text-lg font-semibold text-[#7dd3fc]">{item.avgRotation.toFixed(1)}回/k</p></div>)}</div>
            </Panel>

            <Panel title="新小岩エスパス公開データ" description="公開されている店舗情報と結果データのスナップショットを読み込みます。">
              <div className="flex flex-col gap-4 rounded-2xl border border-[#1f3b66] bg-[#071120] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-7 text-[#d5e6ff]">{sourceMessage}</p>
                  <button className={primaryButtonClass} onClick={loadEspaceSnapshot} disabled={sourceLoading} type="button">{sourceLoading ? "読み込み中..." : "新小岩エスパスを読み込む"}</button>
                </div>
                {espaceSnapshot ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MiniStat label="店舗名" value={espaceSnapshot.storeName} subValue={espaceSnapshot.access} />
                      <MiniStat label="設置台数" value={`パチ ${numberFormat.format(espaceSnapshot.pachinkoMachines)} / スロ ${numberFormat.format(espaceSnapshot.slotMachines)}`} subValue={espaceSnapshot.openingHours} />
                      <MiniStat label="最新集計" value={espaceSnapshot.latestResult.date} subValue={`平均G数 ${numberFormat.format(espaceSnapshot.latestResult.averageGames)} / 勝率 ${espaceSnapshot.latestResult.winRate}`} />
                      <MiniStat label="前日比較" value={espaceSnapshot.previousResult.date} subValue={`平均G数 ${numberFormat.format(espaceSnapshot.previousResult.averageGames)} / 勝率 ${espaceSnapshot.previousResult.winRate}`} />
                    </div>
                    <div className="rounded-2xl border border-[#1f3b66] bg-[#091427] p-4"><p className="text-sm font-medium text-[#dbeafe]">注記</p><p className="mt-2 text-sm leading-7 text-[#bdd0ef]">{espaceSnapshot.note}</p></div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[#1f3b66] bg-[#091427] p-4"><p className="text-sm font-medium text-[#dbeafe]">{espaceSnapshot.latestResult.date} の上位機種</p><div className="mt-3 space-y-3">{espaceSnapshot.latestResult.topMachines.map((machine) => <PublicMachineCard key={machine.machine} row={machine} />)}</div></div>
                      <div className="rounded-2xl border border-[#1f3b66] bg-[#091427] p-4"><p className="text-sm font-medium text-[#dbeafe]">{espaceSnapshot.previousResult.date} の上位機種</p><div className="mt-3 space-y-3">{espaceSnapshot.previousResult.topMachines.map((machine) => <PublicMachineCard key={machine.machine} row={machine} />)}</div></div>
                    </div>
                    <div className="rounded-2xl border border-[#1f3b66] bg-[#091427] p-4"><p className="text-sm font-medium text-[#dbeafe]">公開されている注目日</p><div className="mt-3 flex flex-wrap gap-2">{espaceSnapshot.upcomingEventDays.map((eventDay) => <span key={eventDay} className="rounded-full border border-[#24508a] bg-[#102645] px-3 py-2 text-xs text-[#8bd4ff]">{eventDay}</span>)}</div></div>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="AI分析" description="収支、タグ、ホール実測データ、公開データをまとめて見て次回の狙い方を返します。">
              <div className="rounded-2xl border border-[#1f3b66] bg-[#071120] p-4"><p className="whitespace-pre-wrap text-sm leading-7 text-[#d5e6ff]">{aiMessage}</p></div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#9db9df]">`OPENAI_API_KEY` があると API 分析、ない場合はローカル分析で動きます。</p>
                <button className={primaryButtonClass} onClick={runAiAnalysis} disabled={aiLoading} type="button">{aiLoading ? "AI分析中..." : "AIで分析する"}</button>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-[#1f3b66] bg-[#081527]/92 p-6 shadow-[0_16px_40px_rgba(2,6,23,0.5)]"><div className="mb-5 space-y-2"><h2 className="text-2xl font-semibold text-[#eff6ff]">{props.title}</h2><p className="text-sm leading-7 text-[#bdd0ef]">{props.description}</p></div>{props.children}</section>;
}

function Field(props: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={joinClasses("block", props.className)}><span className="mb-2 block text-sm font-medium text-[#dbeafe]">{props.label}</span>{props.children}</label>;
}

function MetricCard(props: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#1f3b66] bg-[#071120] px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-[#7dd3fc]">{props.label}</p><p className="mt-2 text-2xl font-semibold text-[#eff6ff]">{props.value}</p></div>;
}

function MiniStat(props: { label: string; value: string; subValue: string }) {
  return <div className="rounded-2xl border border-[#1f3b66] bg-[#071120] p-4"><p className="text-sm text-[#9db9df]">{props.label}</p><p className="mt-2 text-xl font-semibold text-[#eff6ff]">{props.value}</p><p className="mt-1 text-sm text-[#7dd3fc]">{props.subValue}</p></div>;
}

function PublicMachineCard(props: { row: PublicMachineRow }) {
  return <div className="flex items-center justify-between rounded-2xl border border-[#1b3558] bg-[#071120] px-4 py-3"><div><p className="font-medium text-[#eff6ff]">{props.row.machine}</p><p className="text-sm text-[#bdd0ef]">平均G数 {numberFormat.format(props.row.averageGames)} / 勝率 {props.row.winRate}</p></div><p className="text-lg font-semibold text-[#7dd3fc]">{props.row.averageDiff === null ? "-" : `${props.row.averageDiff > 0 ? "+" : ""}${numberFormat.format(props.row.averageDiff)}`}</p></div>;
}

const inputClass = "w-full rounded-2xl border border-[#22406e] bg-[#071120] px-4 py-3 text-[#eff6ff] outline-none transition placeholder:text-[#6f8db5] focus:border-[#60a5fa] focus:ring-2 focus:ring-[#2563eb]/30";
const primaryButtonClass = "rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#2952a1]";
