import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Container } from "@/components/ui";
import { CornerMarks } from "@/components/visual/Ornaments";
import { Hanko } from "@/components/visual/Hanko";

export const metadata: Metadata = {
  title: "利用規約",
  description:
    "SK TES Global Auction の利用規約（デモ用サンプル）。入札の拘束力、落札者の決定、輸出入の遵守事項、古物営業法、個人情報の取扱いについて定めています。",
};

const CLAUSES = [
  {
    h: "第1条（適用）",
    p: "本規約は、SK TES Global Auction（以下「本サービス」）の利用条件を定めるものです。本サービスは、SK TESグループ各社が出品するIT機器を、審査を通過した法人バイヤーが入札・購入するための場を提供します。",
  },
  {
    h: "第2条（会員登録）",
    p: "会員登録は、仮登録、書類審査、本登録の順に行います。会社登記簿謄本、身分証明書、輸入ライセンスの写し、および日本国内のバイヤーについては古物商許可証の提出を必要とします。書類に不備がある場合、当社は入札上限を付した仮承認とすることがあります。",
  },
  {
    h: "第3条（入札の拘束力）",
    p: "応札者が送信した入札は、入札締切をもって撤回できないものとします。締切前であれば、再入札または取消により変更できます。落札の通知を受けた場合、応札者は当該条件で購入する義務を負います。",
  },
  {
    h: "第4条（入札金額の秘匿）",
    p: "封印入札方式において、入札金額は出品ごとの鍵で暗号化して保管され、入札締切時刻まで復号されません。出品者、当社の管理者、およびシステム運用者を含め、締切前に金額を閲覧することはできません。",
  },
  {
    h: "第5条（落札者の決定）",
    p: "出品者は、必ずしも最高額の応札者を落札者としない場合があります。この場合、出品者は選定の理由を記録するものとし、当社はこれを監査ログとして保管します。",
  },
  {
    h: "第6条（延長）",
    p: "出品者が延長機能を有効にした出品については、入札締切の直前に入札があった場合、締切時刻を自動的に延長することがあります。延長の条件は出品ごとに表示されます。",
  },
  {
    h: "第7条（支払）",
    p: "支払方法は、銀行振込、クレジットカード、PayPal、請求書払いから選択できます。ただし、決済手数料の負担が過大となるため、当社が定める上限額を超える取引ではクレジットカードおよびPayPalをご利用いただけません。",
  },
  {
    h: "第8条（税)",
    p: "日本国内のバイヤーに対しては、適格請求書等保存方式に対応した請求書を発行し、消費税を課税します。海外のバイヤーに対する販売は輸出免税の取扱いとし、消費税は課されません。輸入国における関税、付加価値税その他の公課は、バイヤーの負担とします。",
  },
  {
    h: "第9条（輸出入）",
    p: "応札者は、落札した商品の輸出入について、自国および仕向国の法令（輸出管理、環境規制、廃電気電子機器に関する規制等）を遵守する責任を負います。",
  },
  {
    h: "第10条（古物営業法）",
    p: "日本国内のバイヤーは、古物営業法に基づく許可を受けていることを表明し、許可証の写しを提出するものとします。",
  },
  {
    h: "第11条（禁止事項）",
    p: "同一の実体による複数会員登録、他の応札者と通じた入札、システムへの不正アクセス、および入札金額の推知を目的とする行為を禁止します。当社はこれらを検知した場合、アカウントの停止または強制退会の措置をとることがあります。",
  },
  {
    h: "第12条（個人情報および記録の保持）",
    p: "当社は、提出された書類および担当者情報を、会員審査、取引の履行、および法令上の記録保持の目的に限り利用します。監査ログの保存期間は7年とします。欧州経済領域その他の地域の会員については、当該地域の個人情報保護法制に従って取り扱います。",
  },
  {
    h: "第13条（免責）",
    p: "本サービスは、出品された商品の状態について、出品者が登録した明細の範囲で情報を提供します。中古品の性質上、個体差が存在することを応札者は了承するものとします。",
  },
];

export default async function TermsPage() {
  const dict = await getDictionary();

  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="border-b border-line bg-surface">
          <Container className="relative py-14">
            <Hanko className="stamp-in absolute right-4 top-8 hidden sm:block" size={88} />
            <p className="season-mark">規約</p>
            <h1 className="font-serif mt-3 text-4xl font-bold tracking-wide text-ink">{dict.nav.terms}</h1>
            <span className="mizuhiki" />
            <p className="mt-4 max-w-2xl rounded-2xl bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
              {dict.home.noticeTitle} — 本文はデモ用のサンプルであり、実際の契約条項ではありません。
            </p>
          </Container>
        </section>
        <Container className="py-12">
          <div className="mx-auto max-w-3xl space-y-4">
            {CLAUSES.map((c) => (
              <section key={c.h} className="card tilt reveal washi-scroll relative p-6">
                <CornerMarks />
                <h2 className="font-serif text-base font-bold text-ink">{c.h}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{c.p}</p>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
