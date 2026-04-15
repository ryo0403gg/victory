import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type IncomeRecord = {
  date: string;
};

type HallDataRow = {
  date: string;
};

function getCutoffDate() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function keepRecentByDate<T extends { date: string }>(rows: T[]) {
  const cutoff = getCutoffDate();

  return rows.filter((row) => {
    const value = new Date(row.date);
    return !Number.isNaN(value.getTime()) && value >= cutoff;
  });
}

export async function GET(request: Request) {
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "local",
      records: null,
      hallData: null,
    });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  if (!deviceId) {
    return NextResponse.json({ message: "deviceId が必要です。" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("analysis_snapshots")
    .select("records, hall_data, updated_at")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "supabase",
    records: keepRecentByDate((data?.records as IncomeRecord[] | null) ?? []),
    hallData: keepRecentByDate((data?.hall_data as HallDataRow[] | null) ?? []),
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "local",
      message: "Supabase 未設定のためローカル保存のみです。",
    });
  }

  const body = (await request.json()) as {
    deviceId?: string;
    records?: IncomeRecord[];
    hallData?: HallDataRow[];
  };

  if (!body.deviceId) {
    return NextResponse.json({ message: "deviceId が必要です。" }, { status: 400 });
  }

  const records = keepRecentByDate(body.records ?? []);
  const hallData = keepRecentByDate(body.hallData ?? []);

  const { error } = await supabase.from("analysis_snapshots").upsert(
    {
      device_id: body.deviceId,
      records,
      hall_data: hallData,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "device_id",
    }
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "supabase",
    recordsCount: records.length,
    hallDataCount: hallData.length,
    message: "Supabase に保存しました。",
  });
}
