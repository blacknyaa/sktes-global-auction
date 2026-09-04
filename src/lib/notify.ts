import { prisma } from "./prisma";
import type { Locale, NotificationChannel } from "./constants";

/**
 * Notification dispatch.
 *
 * Everything the platform sends is written to one table first and delivered
 * second. That is deliberate: the brief lists SMS, Teams, LINE, WhatsApp and
 * WeChat as future channels, and if the sending code is scattered through the
 * business logic, adding a channel later means touching fifty files. Here it
 * means adding one adapter.
 *
 * In the demo no adapter actually sends, so every message lands in the
 * outbox where you can read it. Swapping in SendGrid or Azure Communication
 * Services is a change to `deliver()` alone.
 */

type TemplateKey =
  | "member.applied"
  | "member.under_review"
  | "member.approved"
  | "member.provisional"
  | "member.rejected"
  | "member.suspended"
  | "password.reset"
  | "bid.received"
  | "bid.cancelled"
  | "lot.published"
  | "lot.closing_soon"
  | "award.won"
  | "award.lost"
  | "invoice.issued"
  | "payment.confirmed"
  | "shipment.requested"
  | "shipment.completed"
  | "goods.received"
  | "question.asked"
  | "question.answered";

type Template = { subject: string; body: string };

const TEMPLATES: Record<TemplateKey, Record<Locale, Template>> = {
  "member.applied": {
    ja: { subject: "【SK TES Auction】会員登録を受け付けました", body: "会員登録の申請を受け付けました。提出いただいた書類を確認のうえ、審査結果をご連絡します。審査には通常2〜3営業日かかります。" },
    en: { subject: "[SK TES Auction] Your application has been received", body: "We have received your membership application. We will review the documents you submitted and let you know the outcome, usually within two to three business days." },
    zh: { subject: "【SK TES Auction】已收到您的会员申请", body: "我们已收到您的会员注册申请。将在确认您提交的资料后通知审核结果，通常需要2至3个工作日。" },
  },
  "member.under_review": {
    ja: { subject: "【SK TES Auction】書類審査を開始しました", body: "提出書類の審査を開始しました。追加の書類が必要な場合はあらためてご連絡します。" },
    en: { subject: "[SK TES Auction] Document review has started", body: "We have started reviewing your documents. We will contact you if anything further is needed." },
    zh: { subject: "【SK TES Auction】已开始资料审核", body: "我们已开始审核您提交的资料。如需补充材料将另行联系。" },
  },
  "member.approved": {
    ja: { subject: "【SK TES Auction】本登録が完了しました", body: "審査が完了し、本登録となりました。すべての出品に入札いただけます。" },
    en: { subject: "[SK TES Auction] Your account is fully approved", body: "Your review is complete and your account is now fully approved. You can bid on any listing." },
    zh: { subject: "【SK TES Auction】正式注册已完成", body: "审核已完成，您的账号已正式注册，可对全部标的进行投标。" },
  },
  "member.provisional": {
    ja: { subject: "【SK TES Auction】仮承認となりました（入札上限あり）", body: "書類の一部が未提出のため、入札上限を設けた仮承認としました。残りの書類をご提出いただければ上限を解除します。" },
    en: { subject: "[SK TES Auction] Conditionally approved with a bid cap", body: "Some documents are still outstanding, so your account is approved with a bid cap. Submit the remaining documents and we will lift it." },
    zh: { subject: "【SK TES Auction】已临时批准（设有投标上限）", body: "由于部分资料尚未提交，已为您设置投标上限并临时批准。补齐资料后即可解除上限。" },
  },
  "member.rejected": {
    ja: { subject: "【SK TES Auction】書類の再提出をお願いします", body: "提出いただいた書類に不備がありました。詳細をご確認のうえ、再提出をお願いします。" },
    en: { subject: "[SK TES Auction] Please resubmit your documents", body: "There was a problem with the documents you submitted. Please review the details and send them again." },
    zh: { subject: "【SK TES Auction】请重新提交资料", body: "您提交的资料存在问题，请确认详情后重新提交。" },
  },
  "member.suspended": {
    ja: { subject: "【SK TES Auction】アカウントを停止しました", body: "アカウントを一時停止しました。心当たりがない場合は事務局までご連絡ください。" },
    en: { subject: "[SK TES Auction] Your account has been suspended", body: "Your account has been suspended. If this is unexpected, please contact the operations desk." },
    zh: { subject: "【SK TES Auction】账号已停用", body: "您的账号已被停用。如有疑问请联系运营方。" },
  },
  "password.reset": {
    ja: { subject: "【SK TES Auction】パスワード再設定のご案内", body: "以下のリンクからパスワードを再設定してください。リンクの有効期限は1時間です。" },
    en: { subject: "[SK TES Auction] Password reset", body: "Use the link below to set a new password. The link is valid for one hour." },
    zh: { subject: "【SK TES Auction】密码重置", body: "请通过以下链接重设密码，链接有效期为1小时。" },
  },
  "bid.received": {
    ja: { subject: "【SK TES Auction】入札を受け付けました", body: "入札を受け付けました。金額は暗号化して保管しており、締切まで誰も閲覧できません。" },
    en: { subject: "[SK TES Auction] Your bid has been received", body: "Your bid has been received. The amount is stored encrypted and cannot be read by anyone until the deadline." },
    zh: { subject: "【SK TES Auction】已受理您的投标", body: "已受理您的投标。金额以加密形式保存，截止前任何人都无法查看。" },
  },
  "bid.cancelled": {
    ja: { subject: "【SK TES Auction】入札を取り消しました", body: "入札の取り消しを受け付けました。締切前であれば再度入札いただけます。" },
    en: { subject: "[SK TES Auction] Your bid has been withdrawn", body: "Your bid has been withdrawn. You may bid again before the deadline." },
    zh: { subject: "【SK TES Auction】投标已撤回", body: "您的投标已撤回。截止前可再次投标。" },
  },
  "lot.published": {
    ja: { subject: "【SK TES Auction】新しい出品のお知らせ", body: "新しいロットが公開されました。詳細は出品一覧からご確認ください。" },
    en: { subject: "[SK TES Auction] New lot published", body: "A new lot has been published. See the lot list for details." },
    zh: { subject: "【SK TES Auction】新标的上架通知", body: "已发布新的标的，详情请查看标的一览。" },
  },
  "lot.closing_soon": {
    ja: { subject: "【SK TES Auction】まもなく入札締切です", body: "ご覧のロットがまもなく締め切られます。入札はお早めにお願いします。" },
    en: { subject: "[SK TES Auction] Bidding closes soon", body: "A lot you are watching closes shortly. Please place your bid in good time." },
    zh: { subject: "【SK TES Auction】即将截止投标", body: "您关注的标的即将截止，请尽早投标。" },
  },
  "award.won": {
    ja: { subject: "【SK TES Auction】落札のお知らせ", body: "おめでとうございます。落札されました。契約内容と請求書を追ってお送りします。" },
    en: { subject: "[SK TES Auction] You have won the lot", body: "Congratulations, your bid was selected. Contract details and the invoice will follow." },
    zh: { subject: "【SK TES Auction】成交通知", body: "恭喜，您的投标已被选中。合同内容与发票将随后发送。" },
  },
  "award.lost": {
    ja: { subject: "【SK TES Auction】選定結果のお知らせ", body: "今回は他社様が選定されました。次回のご参加をお待ちしています。" },
    en: { subject: "[SK TES Auction] Outcome of the selection", body: "Another bidder was selected this time. We hope you will take part in the next round." },
    zh: { subject: "【SK TES Auction】评选结果通知", body: "本次由其他公司中标，期待您参与下次投标。" },
  },
  "invoice.issued": {
    ja: { subject: "【SK TES Auction】請求書を発行しました", body: "請求書を発行しました。支払期限までにお手続きをお願いします。" },
    en: { subject: "[SK TES Auction] Invoice issued", body: "Your invoice has been issued. Please arrange payment by the due date." },
    zh: { subject: "【SK TES Auction】发票已开具", body: "发票已开具，请在付款期限前完成付款。" },
  },
  "payment.confirmed": {
    ja: { subject: "【SK TES Auction】ご入金を確認しました", body: "ご入金を確認しました。出荷の手配に入ります。" },
    en: { subject: "[SK TES Auction] Payment confirmed", body: "We have confirmed your payment and will begin arranging shipment." },
    zh: { subject: "【SK TES Auction】已确认收款", body: "已确认收到您的付款，将开始安排发货。" },
  },
  "shipment.requested": {
    ja: { subject: "【SK TES Auction】発送のご依頼", body: "発送・集荷のご依頼を受け付けました。配送業者と日程を調整します。" },
    en: { subject: "[SK TES Auction] Shipment requested", body: "Your shipping and pickup request has been received. We will arrange dates with the carrier." },
    zh: { subject: "【SK TES Auction】发货申请", body: "已受理发货与提货申请，将与承运商协调日程。" },
  },
  "shipment.completed": {
    ja: { subject: "【SK TES Auction】商品を出荷しました", body: "商品を出荷しました。追跡番号は成約詳細画面からご確認いただけます。" },
    en: { subject: "[SK TES Auction] Your goods have shipped", body: "Your goods have shipped. The tracking number is on the contract detail screen." },
    zh: { subject: "【SK TES Auction】商品已发出", body: "商品已发出，可在成交详情页查看追踪单号。" },
  },
  "goods.received": {
    ja: { subject: "【SK TES Auction】商品受領を確認しました", body: "受領確認を受け付けました。取引は完了です。ありがとうございました。" },
    en: { subject: "[SK TES Auction] Receipt confirmed", body: "We have recorded your confirmation of receipt. The transaction is complete. Thank you." },
    zh: { subject: "【SK TES Auction】已确认收货", body: "已记录您的收货确认，交易完成，感谢您的惠顾。" },
  },
  "question.asked": {
    ja: { subject: "【SK TES Auction】出品への質問が届きました", body: "出品しているロットに質問が届きました。管理画面からご回答ください。" },
    en: { subject: "[SK TES Auction] A question about your lot", body: "A buyer has asked a question about one of your lots. Please answer from the console." },
    zh: { subject: "【SK TES Auction】收到关于标的的提问", body: "有买家就您的标的提问，请在管理界面回复。" },
  },
  "question.answered": {
    ja: { subject: "【SK TES Auction】質問に回答がありました", body: "出品者から回答がありました。ロット詳細をご確認ください。" },
    en: { subject: "[SK TES Auction] Your question has been answered", body: "The seller has replied. Please see the lot detail page." },
    zh: { subject: "【SK TES Auction】提问已获回复", body: "出品方已回复，请查看标的详情。" },
  },
};

export async function notify(input: {
  userId?: string | null;
  toAddress: string;
  templateKey: TemplateKey;
  locale?: Locale;
  channel?: NotificationChannel;
  extra?: string;
  relatedType?: string;
  relatedId?: string;
}): Promise<void> {
  const locale = (input.locale ?? "ja") as Locale;
  const tpl = TEMPLATES[input.templateKey][locale];
  const body = input.extra ? `${tpl.body}\n\n${input.extra}` : tpl.body;

  await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      channel: input.channel ?? "EMAIL",
      templateKey: input.templateKey,
      toAddress: input.toAddress,
      subject: tpl.subject,
      body,
      locale,
      status: "SENT", // the demo has no SMTP adapter; the outbox is the proof
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      sentAt: new Date(),
    },
  });
}

export type { TemplateKey };
