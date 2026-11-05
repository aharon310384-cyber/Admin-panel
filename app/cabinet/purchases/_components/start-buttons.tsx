import Link from "next/link";
import { PackagePlus, ShoppingBag } from "lucide-react";

// Две главные кнопки кабинета (стратегия FOX2DOOR, раздел 7.1): «Хочу купить» — покупка под ключ,
// «Я уже купил» — существующее добавление заказа с треком (app/cabinet/new). Ставится на главную кабинета.
export default function PurchaseStartButtons() {
  return (
    <div className="ps-start">
      <Link href="/cabinet/purchases/new" className="ps-start-btn ps-start-btn--buy">
        <span className="ps-start-icon"><ShoppingBag size={22} /></span>
        <span className="ps-start-text">
          <b>Хочу купить</b>
          <small>Пришлите ссылку или скриншот — купим, проверим и доставим</small>
        </span>
      </Link>
      <Link href="/cabinet/new" className="ps-start-btn ps-start-btn--have">
        <span className="ps-start-icon"><PackagePlus size={22} /></span>
        <span className="ps-start-text">
          <b>Я уже купил</b>
          <small>Добавьте трек — примем на складе и отправим</small>
        </span>
      </Link>
      <style>{`
        .ps-start { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 560px) { .ps-start { grid-template-columns: 1fr 1fr; } }
        .ps-start-btn { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: var(--cab-radius-md); text-decoration: none; color: var(--cab-text); background: var(--cab-surface); border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm); transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .ps-start-btn:hover { transform: translateY(-2px); box-shadow: var(--cab-shadow-md); }
        .ps-start-btn--buy { color: #fff; border-color: transparent; background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%); box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 34%, transparent); }
        .ps-start-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 14px; background: color-mix(in srgb, currentColor 14%, transparent); }
        .ps-start-btn--have .ps-start-icon { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 12%, transparent); }
        .ps-start-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ps-start-text b { font-size: 16px; font-weight: 700; }
        .ps-start-text small { font-size: 12px; line-height: 1.35; opacity: 0.85; }
      `}</style>
    </div>
  );
}
