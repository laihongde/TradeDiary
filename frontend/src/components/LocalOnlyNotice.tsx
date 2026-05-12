import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../db/settings";

const DISMISS_KEY = "ui.localOnlyNoticeDismissed";

export function LocalOnlyNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting<boolean>(DISMISS_KEY).then((dismissed) => {
      if (!cancelled) setVisible(!dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3">
        <div>
          <strong>本機儲存版本：</strong>
          所有資料只存在目前瀏覽器的 IndexedDB 中，不會上傳到伺服器。清除瀏覽器資料、更換裝置或更換瀏覽器都可能導致資料無法取得。請定期使用「備份匯出」功能保存資料。
        </div>
        <button
          onClick={() => {
            setSetting(DISMISS_KEY, true);
            setVisible(false);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-amber-700 hover:bg-amber-100"
          aria-label="關閉提示"
        >
          收起
        </button>
      </div>
    </div>
  );
}
