'use strict';

const { url, key } = window.ADMIN_CONFIG;
const sb = window.supabase.createClient(url, key, {
  // The session stays on this device (the panel is only for the admins, who
  // install it as an app): no signing in every time.
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
});

const $ = (id) => document.getElementById(id);
const view = $('view');
const TABS = ['overview', 'profiles', 'answers', 'reports', 'avatars', 'reviews', 'terms', 'rewards', 'audit'];
let tab = 'overview';
let reviewStatus = 'pending';
let reportStatus = 'open';
let avatarStatus = 'pending';

/** Text node factory: nothing from the database is ever parsed as HTML. */
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function fail(message) {
  $('status').textContent = message ? String(message) : '';
}

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    fail(error.message);
    throw error;
  }
  fail('');
  return data;
}

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');

function table(headers, rows, empty) {
  if (!rows.length) return el('p', { class: 'empty' }, empty);
  return el(
    'table',
    {},
    el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
    el('tbody', {}, rows),
  );
}

/** Full-screen detail dialog: everything about one app report, with its screenshot. */
async function openReport(r, labels, onChange) {
  const rows = [
    ['Report #', r.id],
    ['Type', labels[r.category] ?? r.category],
    ['Status', r.status],
    ['Sent', when(r.created_at)],
    ['Handled', when(r.handled_at)],
    ['Reply to', r.reply_to],
    ['Verse', r.ayah_ref],
    ['App version', r.app_version],
    ['Platform', r.platform],
    ['Device', r.device],
    ['Location', r.location],
    ['Calculation', r.method],
    ['Language', r.lang],
    ['Account', r.user_id],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  const text = [
    ...rows.map(([k, v]) => k + ': ' + v),
    '',
    r.message,
  ].join('\n');

  const close = () => overlay.remove();
  const shot = el('div', { class: 'shot' });
  const copy = el('button', {
    onclick: async (e) => {
      await navigator.clipboard.writeText(text);
      e.target.textContent = 'Copied';
    },
  }, 'Copy as text');
  const move = (status) => async (e) => {
    e.target.disabled = true;
    await rpc('admin_set_app_report', { p_id: r.id, p_status: status });
    close();
    onChange();
  };
  const overlay = el(
    'div',
    { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(); } },
    el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'row' }, el('h2', {}, 'Full report'), el('span', { class: 'spacer' }), el('button', { class: 'ghost', onclick: close }, 'Close')),
      el('div', { class: 'message' }, r.message),
      el('dl', {}, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
      shot,
      el(
        'div',
        { class: 'row' },
        copy,
        r.status === 'open'
          ? [el('button', { class: 'primary', onclick: move('answered') }, 'Answered'), el('button', { onclick: move('closed') }, 'Close report')]
          : el('button', { onclick: move('open') }, 'Reopen'),
      ),
    ),
  );
  document.body.append(overlay);

  if (!r.screenshot_path) {
    shot.append(el('p', { class: 'muted' }, 'No screenshot attached.'));
    return;
  }
  shot.append(el('p', { class: 'muted' }, 'Loading screenshot…'));
  const { data, error } = await sb.storage.from('report-screenshots').createSignedUrl(r.screenshot_path, 600);
  shot.textContent = '';
  if (error || !data) {
    shot.append(el('p', { class: 'error' }, 'Could not load the screenshot: ' + (error?.message ?? 'unknown error')));
    return;
  }
  shot.append(
    el('a', { href: data.signedUrl, target: '_blank', rel: 'noopener' }, el('img', { src: data.signedUrl, alt: 'Screenshot attached to the report' })),
    el('p', { class: 'muted' }, 'Click the image to open it full size.'),
  );
}

const views = {
  async overview() {
    const o = await rpc('admin_overview');
    const card = (label, value, alert = false) =>
      el('div', { class: 'card' + (alert && Number(value) > 0 ? ' alert' : '') }, el('b', {}, value), el('span', {}, label));
    return el(
      'div',
      { class: 'cards' },
      card('Open player reports', o.open_profile_reports, true),
      card('Open Ask Deen reports', o.open_answer_reports, true),
      card('Open app reports', o.open_app_reports, true),
      card('Pictures to check', o.pending_avatars, true),
      card('Reviews to check', o.pending_site_reviews, true),
      card('Prizes to deliver', o.pending_rewards, true),
      card('Players', o.players),
      card('Hidden players', o.hidden_players),
      card('Arena games today', o.matches_today),
      card('Arena games, 7 days', o.matches_7d),
      card('Ask Deen questions today', o.questions_today),
      card('Reviews on the website', o.approved_site_reviews),
      card('Banned words', o.banned_terms),
    );
  },

  async profiles() {
    const rows = await rpc('admin_profile_reports', { p_include_reviewed: false, p_limit: 200 });
    const act = (id, hide) => async (e) => {
      e.target.disabled = true;
      await rpc('admin_review_profile_report', { p_id: id, p_hide: hide });
      show();
    };
    return table(
      ['Reported player', 'Reason', 'Reported by', 'Reports against', 'Date', ''],
      rows.map((r) =>
        el(
          'tr',
          {},
          el('td', {}, r.reported_handle ?? '(deleted)', r.reported_hidden ? el('span', { class: 'chip' }, 'hidden') : null),
          el('td', { class: 'long' }, r.reason ?? ''),
          el('td', {}, r.reporter_handle ?? ''),
          el('td', {}, r.reports_against),
          el('td', {}, when(r.created_at)),
          el(
            'td',
            {},
            el('button', { class: 'danger', onclick: act(r.id, true) }, 'Hide player'),
            ' ',
            el('button', { onclick: act(r.id, false) }, 'Dismiss'),
          ),
        ),
      ),
      'No open reports.',
    );
  },

  async answers() {
    const rows = await rpc('admin_answer_reports', { p_include_reviewed: false, p_limit: 200 });
    return table(
      ['Question', 'Answer', 'Reason', 'School / language', 'Date', ''],
      rows.map((r) =>
        el(
          'tr',
          {},
          el('td', { class: 'long' }, r.question),
          el('td', { class: 'long' }, r.answer),
          el('td', { class: 'long' }, r.reason ?? ''),
          el('td', {}, [r.school, r.language].filter(Boolean).join(' / ')),
          el('td', {}, when(r.created_at)),
          el(
            'td',
            {},
            el(
              'button',
              {
                onclick: async (e) => {
                  e.target.disabled = true;
                  await rpc('admin_review_answer_report', { p_id: r.id });
                  show();
                },
              },
              'Mark reviewed',
            ),
          ),
        ),
      ),
      'No open reports.',
    );
  },

  async terms() {
    const terms = await rpc('admin_banned_terms');
    const input = el('input', { id: 'new-term', placeholder: 'a lowercase word, 3–30 letters', maxlength: '30' });
    const add = async () => {
      if (!input.value.trim()) return;
      await rpc('admin_add_banned_term', { p_term: input.value });
      show();
    };
    return el(
      'div',
      {},
      el('p', { class: 'muted' }, 'Handles are checked after removing "_" and undoing digit tricks (0→o, 1→i, 3→e, 4→a, 5→s, 7→t). Short words that hide inside real names stay out on purpose.'),
      el('div', { class: 'row' }, input, el('button', { class: 'primary', onclick: add }, 'Add')),
      el(
        'div',
        {},
        terms.map((t) =>
          el(
            'span',
            { class: 'chip' },
            t,
            ' ',
            el(
              'button',
              {
                class: 'ghost',
                title: 'Remove',
                onclick: async () => {
                  await rpc('admin_remove_banned_term', { p_term: t });
                  show();
                },
              },
              '×',
            ),
          ),
        ),
      ),
    );
  },

  async avatars() {
    const rows = await rpc('admin_avatar_submissions', { p_status: avatarStatus });
    const publicUrl = (path) => sb.storage.from('arena-avatars').getPublicUrl(path).data.publicUrl;
    // A rejected picture's file is deleted: nobody should keep it around.
    const remove = (path) => sb.storage.from('arena-avatars').remove([path]);
    const review = (r, approve) => async (e) => {
      e.target.disabled = true;
      const path = await rpc('admin_review_avatar', { p_id: r.id, p_approve: approve, p_note: null });
      if (!approve) await remove(path);
      show();
    };
    const filter = el(
      'div',
      { class: 'row' },
      [
        ['pending', 'Waiting'],
        ['approved', 'Approved'],
        ['rejected', 'Rejected'],
      ].map(([s, label]) =>
        el(
          'button',
          {
            class: s === avatarStatus ? 'primary' : '',
            onclick: () => {
              avatarStatus = s;
              show();
            },
          },
          label,
        ),
      ),
    );
    const actions = (r) =>
      ({
        pending: [
          el('button', { class: 'primary', onclick: review(r, true) }, 'Approve'),
          ' ',
          el('button', { class: 'danger', onclick: review(r, false) }, 'Reject'),
        ],
        approved: [el('button', { class: 'danger', onclick: review(r, false) }, 'Take down')],
        rejected: [
          el('button', {
            onclick: async (e) => {
              e.target.disabled = true;
              await remove(r.path);
              e.target.textContent = 'File deleted';
            },
          }, 'Delete file'),
        ],
      })[r.status];
    return el(
      'div',
      {},
      el('p', { class: 'muted' }, 'Pictures players send for their Arena profile. An approved picture shows at once next to their name; a rejected one is deleted and they keep the default. Look for faces, text, anything offensive or not theirs to use.'),
      filter,
      table(
        ['Picture', 'Player', 'Sent', ''],
        rows.map((r) =>
          el(
            'tr',
            {},
            el('td', {}, r.status === 'rejected' ? el('span', { class: 'muted' }, 'file may be deleted') : el('a', { href: publicUrl(r.path), target: '_blank', rel: 'noopener' }, el('img', { src: publicUrl(r.path), alt: 'Picture sent by ' + (r.handle ?? 'a player'), width: 96, height: 96, style: 'object-fit:cover;border-radius:12px' }))),
            el('td', {}, r.handle ?? '(no profile)', r.note ? el('div', { class: 'muted' }, r.note) : null),
            el('td', {}, when(r.created_at)),
            el('td', {}, actions(r)),
          ),
        ),
        'Nothing here.',
      ),
    );
  },

  async reviews() {
    const rows = await rpc('admin_site_reviews', { p_status: reviewStatus });
    const set = (id, status) => async (e) => {
      e.target.disabled = true;
      await rpc('admin_set_site_review', { p_id: id, p_status: status });
      show();
    };
    const filter = el(
      'div',
      { class: 'row' },
      [
        ['pending', 'Waiting'],
        ['approved', 'On the website'],
        ['rejected', 'Rejected'],
      ].map(([s, label]) =>
        el(
          'button',
          {
            class: s === reviewStatus ? 'primary' : '',
            onclick: () => {
              reviewStatus = s;
              show();
            },
          },
          label,
        ),
      ),
    );
    const actions = (r) =>
      ({
        pending: [
          el('button', { class: 'primary', onclick: set(r.id, 'approved') }, 'Publish'),
          ' ',
          el('button', { class: 'danger', onclick: set(r.id, 'rejected') }, 'Reject'),
        ],
        approved: [el('button', { onclick: set(r.id, 'rejected') }, 'Remove from website')],
        rejected: [el('button', { onclick: set(r.id, 'approved') }, 'Publish')],
      })[r.status];
    return el(
      'div',
      {},
      el('p', { class: 'muted' }, 'Reviews sent from the website form. Published ones appear on the website at once, as written (they cannot be edited).'),
      filter,
      table(
        ['Review', 'Stars', 'Name', 'Language', 'Sent', ''],
        rows.map((r) =>
          el(
            'tr',
            {},
            el('td', { class: 'long' }, r.body),
            el('td', { class: 'stars' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
            el('td', {}, r.name, r.place ? el('div', { class: 'muted' }, r.place) : null),
            el('td', {}, r.lang),
            el('td', {}, when(r.created_at)),
            el('td', {}, actions(r)),
          ),
        ),
        'Nothing here.',
      ),
    );
  },

  async reports() {
    const rows = await rpc('admin_app_reports', { p_status: reportStatus });
    const set = (id, status) => async (e) => {
      e.target.disabled = true;
      await rpc('admin_set_app_report', { p_id: id, p_status: status });
      show();
    };
    const labels = {
      bug: 'Bug',
      wrongPrayerTime: 'Wrong prayer time',
      contentError: 'Content error',
      featureIdea: 'Idea',
      other: 'Other',
    };
    const filter = el(
      'div',
      { class: 'row' },
      [
        ['open', 'Open'],
        ['answered', 'Answered'],
        ['closed', 'Closed'],
      ].map(([s, label]) =>
        el(
          'button',
          {
            class: s === reportStatus ? 'primary' : '',
            onclick: () => {
              reportStatus = s;
              show();
            },
          },
          label,
        ),
      ),
    );
    const actions = (r) =>
      r.status === 'open'
        ? [
            el('button', { class: 'primary', onclick: set(r.id, 'answered') }, 'Answered'),
            ' ',
            el('button', { onclick: set(r.id, 'closed') }, 'Close'),
          ]
        : [el('button', { onclick: set(r.id, 'open') }, 'Reopen')];
    const details = (r) =>
      [r.app_version && 'v' + r.app_version, r.platform, r.device, r.location, r.method, r.lang]
        .filter(Boolean)
        .join(' · ');
    return el(
      'div',
      {},
      el('p', { class: 'muted' }, 'Reports sent from the app the moment the user pressed send. If they left an email, you can answer there.'),
      filter,
      table(
        ['Report', 'Type', 'Reply to', 'Device', 'Sent', ''],
        rows.map((r) =>
          el(
            'tr',
            {},
            el(
              'td',
              { class: 'long' },
              el('div', { class: 'clamp' }, r.message),
              r.ayah_ref ? el('div', { class: 'muted' }, 'Verse ' + r.ayah_ref) : null,
              r.screenshot_path ? el('span', { class: 'chip' }, '📎 screenshot') : null,
            ),
            el('td', {}, labels[r.category] ?? r.category),
            el('td', {}, r.reply_to ?? '—'),
            el('td', { class: 'muted' }, details(r)),
            el('td', {}, when(r.created_at)),
            el('td', {}, el('button', { class: 'primary', onclick: () => openReport(r, labels, show) }, 'Full report'), ' ', actions(r)),
          ),
        ),
        'Nothing here.',
      ),
    );
  },

  async rewards() {
    const rows = await rpc('admin_rewards', { p_only_open: true });
    const set = (id, status, notes) => async () => {
      await rpc('admin_set_reward', { p_id: id, p_status: status, p_notes: notes.value || null });
      show();
    };
    return table(
      ['Player', 'Prize', 'Period', 'Status', 'Notes', ''],
      rows.map((r) => {
        const notes = el('input', { value: r.notes ?? '', placeholder: 'notes', maxlength: '500' });
        return el(
          'tr',
          {},
          el('td', {}, r.handle ?? r.user_id),
          el('td', {}, r.kind === 'lifetime_free' ? 'Free for life' : "Noor's gift"),
          el('td', {}, r.period),
          el('td', {}, r.status),
          el('td', {}, notes),
          el(
            'td',
            {},
            el('button', { onclick: set(r.id, 'contacted', notes) }, 'Contacted'),
            ' ',
            el('button', { class: 'primary', onclick: set(r.id, 'delivered', notes) }, 'Delivered'),
          ),
        );
      }),
      'No prizes waiting.',
    );
  },

  async audit() {
    const rows = await rpc('admin_audit_log', { p_limit: 200 });
    return table(
      ['Date', 'Action', 'Target', 'Detail', 'Admin'],
      rows.map((r) =>
        el(
          'tr',
          {},
          el('td', {}, when(r.created_at)),
          el('td', {}, r.action),
          el('td', {}, r.target ?? ''),
          el('td', { class: 'long' }, JSON.stringify(r.detail)),
          el('td', {}, r.admin_id ?? ''),
        ),
      ),
      'Nothing yet.',
    );
  },
};

async function show() {
  try {
    view.replaceChildren(await views[tab]());
  } catch (e) {
    view.replaceChildren();
  }
}

async function enter() {
  const { data } = await sb.auth.getSession();
  const session = data.session;
  const ok = session && (await sb.rpc('is_admin')).data === true;
  $('login').hidden = !!ok;
  $('app').hidden = !ok;
  if (ok) {
    const fromHash = location.hash.slice(1);
    if (TABS.includes(fromHash)) openTab(fromHash);
    else show();
    refreshNotify().catch(() => {});
  } else if (session) {
    $('login-error').textContent = 'This account is not an admin.';
    await sb.auth.signOut();
  }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value, password: $('password').value });
  if (error) $('login-error').textContent = error.message;
  else enter();
});

$('sign-out').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

function openTab(t) {
  if (!TABS.includes(t)) return;
  tab = t;
  for (const b of $('tabs').children) b.classList.toggle('active', b.dataset.tab === t);
  if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
  show();
}

$('tabs').addEventListener('click', (e) => {
  const t = e.target.dataset?.tab;
  if (t) openTab(t);
});

// A notification opens the panel on the tab it is about.
window.addEventListener('hashchange', () => openTab(location.hash.slice(1)));
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => e.data?.tab && openTab(e.data.tab));
}

// ---- Notifications (Web Push) --------------------------------------------

const notifyButton = $('notify');

function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function registration() {
  return navigator.serviceWorker.register('sw.js', { scope: './' }).then(() => navigator.serviceWorker.ready);
}

/** Shows what the notifications button can do right now. */
async function refreshNotify() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  notifyButton.hidden = !supported || !window.ADMIN_CONFIG.vapidPublicKey;
  if (notifyButton.hidden) return;
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  const blocked = Notification.permission === 'denied';
  notifyButton.disabled = blocked;
  notifyButton.textContent = blocked ? 'Notifications blocked' : sub ? 'Send a test notification' : 'Turn on notifications';
  notifyButton.dataset.state = blocked ? 'blocked' : sub ? 'on' : 'off';
  notifyButton.title = sub ? 'Notifications are on. Right-click (or long-press) to turn them off on this device.' : '';
}

notifyButton.addEventListener('click', async () => {
  try {
    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await rpc('admin_test_push');
      return;
    }
    if ((await Notification.requestPermission()) !== 'granted') return refreshNotify();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.ADMIN_CONFIG.vapidPublicKey),
    });
    await rpc('admin_save_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: bufferToBase64(sub.getKey('p256dh')),
      p_auth: bufferToBase64(sub.getKey('auth')),
      p_user_agent: navigator.userAgent,
    });
    await rpc('admin_test_push');
  } catch (e) {
    fail('Could not turn notifications on: ' + (e.message || e));
  }
  refreshNotify();
});

// Right-click / long-press: turn them off on this device.
notifyButton.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await rpc('admin_remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
  refreshNotify();
});

enter();
