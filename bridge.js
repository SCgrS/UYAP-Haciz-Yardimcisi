// ISOLATED dünya köprüsü.
//
// content.js sayfanın MAIN dünyasında çalışır (banka eşleştirme mekaniği orada
// doğrulanmıştır) ve chrome.* API'lerine erişemez. Bu dosya, popup/service
// worker ile sayfa arasında yalnız düz metin (JSON) taşır.
'use strict';

(() => {
  // İzole dünyanın kendi window'u vardır; bu kayıt content.js'tekinden
  // bağımsızdır. Eklenti yenilendiğinde sayfada kalan eski köprünün
  // chrome.* bağlantısı geçersizleşir ama olay dinleyicisi durur; nesil
  // damgası eskiyi devre dışı bırakır.
  const REGISTRY = (window.__UBH_BRIDGE_V2 = window.__UBH_BRIDGE_V2 || { gen: 0 });
  const MY_GENERATION = ++REGISTRY.gen;
  const isCurrent = () => REGISTRY.gen === MY_GENERATION;

  const TO_PAGE = 'UBH_TO_PAGE_V2';
  const TO_EXT = 'UBH_TO_EXT_V2';

  const toPage = message => {
    document.dispatchEvent(
      new CustomEvent(TO_PAGE, { detail: JSON.stringify(message) })
    );
  };

  const send = message => chrome.runtime.sendMessage(message).catch(() => {});

  chrome.runtime.onMessage.addListener(message => {
    if (!isCurrent()) return;

    if (message?.type === 'UBH_START') {
      toPage({
        t: 'START',
        flow: message.flow,
        payment: message.payment,
        sms: message.sms,
        evrak: message.evrak,
        paid: message.paid
      });
    }
  });

  document.addEventListener(TO_EXT, async event => {
    if (!isCurrent()) return;

    let message;
    try {
      message = JSON.parse(event.detail);
    } catch (_) {
      return;
    }

    switch (message.t) {
      case 'STEP':
        send({
          type: 'UBH_STEP',
          label: message.label,
          index: message.index,
          total: message.total
        });
        break;

      case 'DONE':
        send({ type: 'UBH_DONE', label: message.label });
        break;

      case 'FAIL':
        send({ type: 'UBH_FAIL', label: message.label, detail: message.detail });
        break;

      case 'RESET':
        send({ type: 'UBH_RESET' });
        break;

      case 'STAGE':
        send({
          type: 'UBH_STAGE',
          key: message.key,
          name: message.name,
          state: message.state,
          note: message.note
        });
        break;

      case 'SAVE_BANKS':
        send({ type: 'UBH_SAVE_BANKS', banks: message.banks });
        break;

      case 'GET_BANKS': {
        let banks = [];
        try {
          const response = await chrome.runtime.sendMessage({ type: 'UBH_GET_BANKS' });
          banks = response?.banks || [];
        } catch (_) {
          banks = [];
        }
        toPage({ t: 'BANKS', reqId: message.reqId, banks });
        break;
      }
    }
  });
})();
