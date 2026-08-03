/**
 * Forwards new inbox mail to a Cursor Automation webhook.
 * Install: run installTrigger() once after setting Script Properties.
 */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processNewEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processNewEmails').timeBased().everyMinutes(1).create();
}

function processNewEmails() {
  var props = PropertiesService.getScriptProperties();
  var webhook = props.getProperty('CURSOR_WEBHOOK_URL');
  var key = props.getProperty('CURSOR_WEBHOOK_KEY');
  if (!webhook || !key) {
    console.error('Missing CURSOR_WEBHOOK_URL or CURSOR_WEBHOOK_KEY script properties');
    return;
  }

  var threads = GmailApp.search('in:inbox is:unread -label:cursor-agented', 0, 20);
  var label = getOrCreateLabel_('cursor-agented');

  threads.forEach(function (thread) {
    var msg = thread.getMessages()[thread.getMessageCount() - 1];
    var payload = {
      from: msg.getFrom(),
      to: msg.getTo(),
      subject: msg.getSubject(),
      date: msg.getDate().toISOString(),
      body: msg.getPlainBody().slice(0, 20000),
      messageId: msg.getId(),
      threadId: thread.getId(),
    };

    var res = UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + key,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var code = res.getResponseCode();
    console.log('Cursor webhook status', code, res.getContentText().slice(0, 300));
    if (code >= 200 && code < 300) {
      label.addToThread(thread);
      thread.markRead();
    }
  });
}

function getOrCreateLabel_(name) {
  var label = GmailApp.getUserLabelByName(name);
  return label || GmailApp.createLabel(name);
}

/** Manual test from the Apps Script editor */
function sendTestPayload() {
  var props = PropertiesService.getScriptProperties();
  UrlFetchApp.fetch(props.getProperty('CURSOR_WEBHOOK_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + props.getProperty('CURSOR_WEBHOOK_KEY') },
    payload: JSON.stringify({
      from: 'test@cutline-industries.studio',
      subject: 'TEST email → cursor',
      date: new Date().toISOString(),
      body: 'Ping from Apps Script test. Reply in the agent if received.',
    }),
  });
}
