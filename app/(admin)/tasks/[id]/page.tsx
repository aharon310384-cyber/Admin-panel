import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import { ORDER_STATUS_COLOR, PARCEL_STATUS_COLOR, TASK_STATUS_COLOR, orderStatusLabel, parcelStatusLabel, taskStatusLabel } from "@/lib/statuses";
import Form from "@/components/form/form";
import ClickableRow from "@/components/ui/clickable-row";

export const metadata: Metadata = { title: "Задача" };

// Карточка задачи на формирование посылки — только просмотр (docs/product/задание-журналы.md, шаг 1):
// поля задачи, внутренний комментарий, заказы, посылка, сборка / упаковка / взвешивание. «Связанные документы» — Ctrl+Shift+S.

const dash = (value: string | null | undefined) => value?.trim() || "—";
const kg = (value: unknown) => (value == null ? "—" : `${formatNumber(Number(value))} кг`);
const cm = (value: unknown) => (value == null ? "?" : formatNumber(Number(value)));

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.parcelTask.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      createdBy: { select: { name: true } },
      orders: {
        where: { deletedAt: null },
        select: { id: true, number: true, trackNumber: true, productNameText: true, quantity: true, status: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { number: "asc" }],
      },
      parcel: { select: { id: true, number: true, status: true, trackingNumber: true, totalUsd: true, createdAt: true } },
      assembly: { include: { createdBy: { select: { name: true } } } },
      packing: { include: { createdBy: { select: { name: true } } } },
      weighing: { include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!task) notFound();
  const country = task.destinationCountry
    ? await prisma.country.findUnique({ where: { code: task.destinationCountry }, select: { nameEn: true } })
    : null;
  const steps = [
    task.assembly && {
      kind: "Сборка",
      doc: task.assembly,
      details: task.assembly.allFound ? "все заказы найдены" : "найдены не все заказы",
    },
    task.packing && {
      kind: "Упаковка",
      doc: task.packing,
      details: [task.packing.packagingType, `мест: ${task.packing.placesCount}`].filter(Boolean).join(" · "),
    },
    task.weighing && {
      kind: "Взвешивание",
      doc: task.weighing,
      details: [
        kg(task.weighing.weightKg),
        task.weighing.lengthCm || task.weighing.widthCm || task.weighing.heightCm
          ? `${cm(task.weighing.lengthCm)}×${cm(task.weighing.widthCm)}×${cm(task.weighing.heightCm)} см`
          : null,
        task.weighing.volumetricWeightKg != null ? `объёмный ${kg(task.weighing.volumetricWeightKg)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ].filter((step): step is NonNullable<typeof step> => Boolean(step));

  return (
    <Form
      formKey="task"
      guid={task.id}
      title={task.number}
      titleExtra={
        <>
          <span className={`st st--${TASK_STATUS_COLOR[task.status]}`}>{taskStatusLabel(task.status)}</span>
          {task.deletedAt && <span className="st st--canceled">помечена на удаление</span>}
        </>
      }
      footer={<>Только просмотр: задача меняется загрузкой из Excel и работой склада. Связанные документы — Ctrl+Shift+S.</>}
    >
      <div className="tk-grid">
        <section className="card">
          <h2 className="card-title">Задача</h2>
          <dl className="tk-dl">
            <dt>Номер</dt><dd className="mono">{task.number}</dd>
            <dt>Дата</dt><dd>{formatDateTime(task.createdAt)}</dd>
            <dt>Статус</dt><dd>{taskStatusLabel(task.status)}</dd>
            <dt>Клиент</dt>
            <dd>
              <Link href={`/clients/${task.customer.id}`}>{task.customer.code ? `${task.customer.code} — ` : ""}{task.customer.name}</Link>
            </dd>
            <dt>Страна</dt><dd>{task.destinationCountry ? `${task.destinationCountry}${country ? ` — ${country.nameEn}` : ""}` : "—"}</dd>
            <dt>Примечание</dt><dd className="pre">{dash(task.note)}</dd>
            <dt>Автор</dt><dd>{task.createdBy.name}</dd>
            <dt>Изменена</dt><dd>{formatDateTime(task.updatedAt)}</dd>
            {task.deletedAt && (<><dt>Помечена на удаление</dt><dd>{formatDateTime(task.deletedAt)}</dd></>)}
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">Внутренний комментарий <span className="muted">· видят только сотрудники</span></h2>
          <p className="pre">{dash(task.internalComment)}</p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">Заказы задачи <span className="muted">· {task.orders.length}</span></h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Дата</th><th>Номер</th><th>Входящий трек-номер</th><th>Наименование</th><th className="num">Кол-во</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {task.orders.map((o) => (
                <ClickableRow key={o.id} href={`/orders/${o.id}/edit`} doc={{ entity: "order", id: o.id }}>
                  <td className="muted">{formatDateTime(o.createdAt)}</td>
                  <td className="mono"><Link href={`/orders/${o.id}/edit`}>{o.number ?? "—"}</Link></td>
                  <td className="mono">{dash(o.trackNumber)}</td>
                  <td>{dash(o.productNameText)}</td>
                  <td className="num">{o.quantity}</td>
                  <td><span className={`st st--${ORDER_STATUS_COLOR[o.status]}`}>{orderStatusLabel(o.status)}</span></td>
                </ClickableRow>
              ))}
              {task.orders.length === 0 && <tr><td colSpan={6} className="table-empty">Заказов нет</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="tk-grid">
        <section className="card">
          <h2 className="card-title">Посылка</h2>
          {task.parcel ? (
            <dl className="tk-dl">
              <dt>Номер</dt><dd className="mono"><Link href={`/parcels/${task.parcel.id}`}>{task.parcel.number}</Link></dd>
              <dt>Дата</dt><dd>{formatDateTime(task.parcel.createdAt)}</dd>
              <dt>Статус</dt><dd><span className={`st st--${PARCEL_STATUS_COLOR[task.parcel.status]}`}>{parcelStatusLabel(task.parcel.status)}</span></dd>
              <dt>Трек-номер</dt><dd className="mono">{dash(task.parcel.trackingNumber)}</dd>
              <dt>Итог</dt><dd>{formatUsd(task.parcel.totalUsd)}</dd>
            </dl>
          ) : (
            <p className="muted">Посылки ещё нет</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Сборка, упаковка, взвешивание</h2>
          {steps.length ? (
            <dl className="tk-dl">
              {steps.map((step) => (
                <div key={step.kind} className="tk-step">
                  <dt>{step.kind}</dt>
                  <dd>
                    <span className="mono">{step.doc.number}</span> от {formatDateTime(step.doc.createdAt)} · {step.doc.createdBy.name}
                    {step.details ? <div className="muted">{step.details}</div> : null}
                    {step.doc.note ? <div className="muted pre">{step.doc.note}</div> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">Документов склада по задаче ещё нет</p>
          )}
        </section>
      </div>

      <style>{`
        .tk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 12px 14px; font-size: 13.5px; }
        .card-title { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
        .card p { margin: 0; }
        .tk-dl { margin: 0; display: grid; grid-template-columns: minmax(130px, auto) 1fr; gap: 6px 14px; }
        .tk-dl dt { color: var(--color-muted); }
        .tk-dl dd { margin: 0; word-break: break-word; }
        .tk-step { display: contents; }
        .card a { color: var(--color-accent); text-decoration: none; }
        .card a:hover { text-decoration: underline; }
        .pre { white-space: pre-wrap; }
        .muted { color: var(--color-muted); font-weight: 400; }
        .mono { font-family: var(--font-mono); font-size: 12.5px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .table-wrap { overflow-x: auto; margin: 0 -14px -12px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th { text-align: left; padding: 8px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 9px 14px; border-top: 1px solid var(--color-border); white-space: nowrap; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 24px 16px !important; color: var(--color-muted); }
        .st { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .st--assembled { color: var(--color-status-assembled); background: var(--color-status-assembled-bg); }
        .st--ready { color: var(--color-status-ready); background: var(--color-status-ready-bg); }
        .st--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .st--utilized { color: var(--color-status-utilized); background: var(--color-status-utilized-bg); }
      `}</style>
    </Form>
  );
}
