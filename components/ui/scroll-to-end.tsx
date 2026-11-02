"use client";

// Журнал по дате от старых к новым, как в 1С, открывается на последних строках: новые документы внизу видны сразу.
// Ставится в карточку рядом с .table-wrap; token — пусто, если прокручивать не нужно, иначе меняется вместе со строками.
import { useLayoutEffect, useRef } from "react";

export default function ScrollToEnd({ token }: { token: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement?.querySelector<HTMLElement>(".table-wrap");
    if (token && wrap) wrap.scrollTop = wrap.scrollHeight;
  }, [token]);

  return <span ref={ref} hidden />;
}
