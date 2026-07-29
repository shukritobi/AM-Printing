(() => {
  const STORAGE_KEY = 'am_orders_v1';
  const SETTINGS_KEY = 'am_settings_v1';
  const WORKERS_KEY = 'am_workers_v1';
  const STATUS_STEPS = [
    'Tempahan diterima',
    'Semakan artwork',
    'Menunggu approval',
    'Printing',
    'Folding & packing',
    'Quality check',
    'Sedia dihantar',
    'Selesai'
  ];

  const productLabels = {
    'sampul-raya': 'Sampul Duit Raya',
    stickers: 'Sticker & Label',
    'photo-4r': '4R Photo Printing',
    polaroid: 'Polaroid & Mini Prints',
    cards: 'Custom Cards',
    bulk: 'Bulk / Corporate'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const getOrders = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  };
  const saveOrders = (orders) => localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  const formatMoney = (value) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value || 0));
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  const showToast = (message) => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  };

  const generateOrderId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `AM${yy}${mm}${dd}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const sampleNames = ['Aina Rahman', 'Nadia Khalid', 'Fatin Farhana', 'Zulaikha Studio', 'Dapur Murni', 'Hafiz & Co.'];
  const sampleProducts = Object.keys(productLabels);
  const sampleOrders = () => {
    const today = new Date();
    return sampleNames.map((name, index) => {
      const created = new Date(today);
      created.setDate(today.getDate() - index);
      const due = new Date(today);
      due.setDate(today.getDate() + index + 2);
      const statusIndex = index % 7;
      return {
        id: generateOrderId(),
        customerName: name,
        phone: `01${index + 1}-23${index}45${index}`,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        product: sampleProducts[index % sampleProducts.length],
        quantity: [1000, 300, 20, 500, 150, 1200][index],
        estimate: [480, 95, 40, 210, 78, 560][index],
        dueDate: due.toISOString().slice(0, 10),
        createdAt: created.toISOString(),
        updatedAt: new Date().toISOString(),
        status: STATUS_STEPS[statusIndex],
        statusIndex,
        paymentStatus: index % 3 === 0 ? 'Deposit paid' : index % 3 === 1 ? 'Paid' : 'Belum disahkan',
        notes: index % 2 ? 'Please check colour before printing.' : 'Customer needs delivery update.',
        fileName: `artwork-${index + 1}.pdf`,
        source: index % 2 ? 'Shopee' : 'Website',
        artwork: index % 3 === 0 ? 'design' : 'ready',
        urgency: index % 4 === 0 ? 'priority' : 'normal',
        size: 'standard',
        material: index % 2 ? 'premium' : 'standard'
      };
    });
  };

  const ensureWorkers = () => {
    let workers = [];
    try { workers = JSON.parse(localStorage.getItem(WORKERS_KEY)) || []; } catch { workers = []; }
    if (!workers.length) {
      workers = [
        { id: 1, name: 'Worker A', task: 'Fold & pack sampul', target: 1000, completed: 760, rate: 0.08 },
        { id: 2, name: 'Worker B', task: 'Sticker sorting', target: 500, completed: 300, rate: 0.06 },
        { id: 3, name: 'Worker C', task: 'QC & packing', target: 800, completed: 620, rate: 0.07 }
      ];
      localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
    }
    return workers;
  };

  const navButtons = $$('.admin-nav button');
  const views = $$('.admin-view');
  const viewMeta = {
    overview: ['Dashboard', 'Business overview'],
    orders: ['Order management', 'All orders'],
    production: ['Production', 'Job board'],
    customers: ['Customers', 'Customer database'],
    workers: ['Operations', 'Worker assignments'],
    settings: ['Configuration', 'System settings']
  };

  const switchView = (view) => {
    navButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    views.forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
    $('#viewEyebrow').textContent = viewMeta[view][0];
    $('#viewTitle').textContent = viewMeta[view][1];
    $('#adminSidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderAll();
  };

  navButtons.forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('[data-jump]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.jump)));
  $('#sidebarToggle').addEventListener('click', () => $('#adminSidebar').classList.toggle('open'));

  const renderStats = (orders) => {
    const active = orders.filter((order) => Number(order.statusIndex) < STATUS_STEPS.length - 1).length;
    const printing = orders.filter((order) => order.status === 'Printing').length;
    const dueSoon = orders.filter((order) => {
      if (!order.dueDate) return false;
      const days = (new Date(order.dueDate) - new Date()) / 86400000;
      return days >= -1 && days <= 3 && Number(order.statusIndex) < STATUS_STEPS.length - 1;
    }).length;
    const total = orders.reduce((sum, order) => sum + Number(order.estimate || 0), 0);
    const stats = [
      { label: 'Active orders', value: active, note: `${orders.length} total orders`, icon: '▤' },
      { label: 'In printing', value: printing, note: 'Current production queue', icon: '▦' },
      { label: 'Due within 3 days', value: dueSoon, note: 'Requires attention', icon: '!' },
      { label: 'Estimated value', value: formatMoney(total), note: 'Based on recorded orders', icon: 'RM' }
    ];
    $('#statsGrid').innerHTML = stats.map((item) => `
      <article class="stat-card"><div class="stat-head"><span>${item.label}</span><i class="stat-icon">${item.icon}</i></div><strong>${item.value}</strong><small>${item.note}</small></article>
    `).join('');
  };

  const renderChart = (orders) => {
    const days = Number($('#chartRange').value || 7);
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const value = orders.filter((order) => String(order.createdAt).slice(0, 10) === key).reduce((sum, order) => sum + Number(order.estimate || 0), 0);
      series.push({ label: date.toLocaleDateString('en-MY', { weekday: 'short' }).slice(0, 2), value });
    }
    const max = Math.max(...series.map((point) => point.value), 1);
    $('#salesChart').innerHTML = series.map((point) => `
      <div class="chart-column"><div class="chart-bar" data-value="${formatMoney(point.value)}" style="height:${Math.max(3, (point.value / max) * 88)}%"></div><small>${point.label}</small></div>
    `).join('');
  };

  const renderStatusList = (orders) => {
    const activeStatuses = ['Semakan artwork', 'Menunggu approval', 'Printing', 'Folding & packing', 'Quality check'];
    const max = Math.max(...activeStatuses.map((status) => orders.filter((order) => order.status === status).length), 1);
    $('#statusList').innerHTML = activeStatuses.map((status) => {
      const count = orders.filter((order) => order.status === status).length;
      return `<div class="status-row"><div class="status-row-head"><strong>${status}</strong><span>${count}</span></div><div class="status-progress"><i style="width:${(count / max) * 100}%"></i></div></div>`;
    }).join('');
  };

  const orderRow = (order, actions = false) => `
    <tr>
      <td><button class="plain-button order-id" data-open-order="${escapeHtml(order.id)}">${escapeHtml(order.id)}</button></td>
      <td class="customer-cell"><strong>${escapeHtml(order.customerName || '-')}</strong><span>${escapeHtml(order.phone || '')}</span></td>
      <td>${escapeHtml(productLabels[order.product] || order.product)}</td>
      ${actions ? `<td>${Number(order.quantity || 0).toLocaleString('en-MY')}</td>` : ''}
      ${actions ? '' : `<td>${formatDate(order.dueDate)}</td>`}
      <td><span class="status-pill">${escapeHtml(order.status)}</span></td>
      ${actions ? `<td><span class="payment-pill">${escapeHtml(order.paymentStatus || 'Belum disahkan')}</span></td>` : ''}
      <td>${formatMoney(order.estimate)}</td>
      ${actions ? `<td><button class="row-actions" data-open-order="${escapeHtml(order.id)}">View</button></td>` : ''}
    </tr>`;

  const bindOrderButtons = () => $$('[data-open-order]').forEach((button) => button.addEventListener('click', () => openOrderDetail(button.dataset.openOrder)));

  const renderRecent = (orders) => {
    const body = $('#recentOrdersBody');
    body.innerHTML = orders.length ? orders.slice(0, 6).map((order) => orderRow(order)).join('') : '<tr><td class="empty-row" colspan="6">No orders yet. Add a sample or create a new order.</td></tr>';
    bindOrderButtons();
  };

  const renderOrders = (orders) => {
    const search = $('#orderSearch').value.trim().toLowerCase();
    const filter = $('#orderFilter').value;
    const filtered = orders.filter((order) => {
      const haystack = `${order.id} ${order.customerName} ${order.phone} ${productLabels[order.product]}`.toLowerCase();
      return (!search || haystack.includes(search)) && (filter === 'all' || order.status === filter);
    });
    $('#ordersBody').innerHTML = filtered.length ? filtered.map((order) => orderRow(order, true)).join('') : '<tr><td class="empty-row" colspan="8">No matching orders.</td></tr>';
    bindOrderButtons();
  };

  const renderKanban = (orders) => {
    const boardStatuses = ['Tempahan diterima', 'Semakan artwork', 'Menunggu approval', 'Printing', 'Folding & packing', 'Quality check', 'Sedia dihantar'];
    $('#kanbanBoard').innerHTML = boardStatuses.map((status) => {
      const jobs = orders.filter((order) => order.status === status);
      return `<section class="kanban-column"><div class="kanban-head"><span>${status}</span><span class="kanban-count">${jobs.length}</span></div><div class="kanban-list">${jobs.map((order) => `
        <article class="job-card" data-open-order="${escapeHtml(order.id)}"><div class="job-card-top"><strong>${escapeHtml(order.id)}</strong><small>${formatDate(order.dueDate)}</small></div><h3>${escapeHtml(order.customerName || '-')}</h3><p>${escapeHtml(productLabels[order.product])} × ${Number(order.quantity || 0).toLocaleString('en-MY')}</p><div class="job-card-foot"><span>${escapeHtml(order.urgency || 'normal')}</span><b>${formatMoney(order.estimate)}</b></div></article>
      `).join('') || '<p class="empty-row">No jobs</p>'}</div></section>`;
    }).join('');
    bindOrderButtons();
  };

  const renderCustomers = (orders) => {
    const map = new Map();
    orders.forEach((order) => {
      const key = order.phone || order.email || order.customerName;
      if (!map.has(key)) map.set(key, { name: order.customerName || '-', phone: order.phone || '-', orders: 0, value: 0 });
      const entry = map.get(key);
      entry.orders += 1;
      entry.value += Number(order.estimate || 0);
    });
    const customers = [...map.values()].sort((a, b) => b.value - a.value);
    $('#customerGrid').innerHTML = customers.length ? customers.map((customer) => `
      <article class="customer-card"><div class="customer-head"><span class="customer-avatar">${escapeHtml(customer.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.phone)}</span></div></div><div class="customer-metrics"><span><b>${customer.orders}</b>Orders</span><span><b>${formatMoney(customer.value)}</b>Value</span></div></article>
    `).join('') : '<p class="empty-row">Customer profiles appear after orders are added.</p>';
  };

  const renderWorkers = () => {
    const workers = ensureWorkers();
    $('#workerGrid').innerHTML = workers.map((worker) => {
      const percent = Math.min(100, Math.round((worker.completed / worker.target) * 100));
      return `<article class="worker-card"><div class="worker-card-head"><span class="customer-avatar">${escapeHtml(worker.name.slice(-1))}</span><span class="status-pill">Active</span></div><h3>${escapeHtml(worker.name)}</h3><p>${escapeHtml(worker.task)}</p><div class="worker-progress"><i style="width:${percent}%"></i></div><div class="worker-stats"><span><strong>${worker.completed}/${worker.target}</strong> completed</span><span><strong>RM${Number(worker.rate).toFixed(2)}</strong> / piece</span></div></article>`;
    }).join('');
  };

  const populateFilter = () => {
    const filter = $('#orderFilter');
    if (filter.options.length > 1) return;
    STATUS_STEPS.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      filter.appendChild(option);
    });
  };

  const renderAll = () => {
    const orders = getOrders();
    renderStats(orders);
    renderChart(orders);
    renderStatusList(orders);
    renderRecent(orders);
    renderOrders(orders);
    renderKanban(orders);
    renderCustomers(orders);
    renderWorkers();
  };

  $('#chartRange').addEventListener('change', () => renderChart(getOrders()));
  $('#orderSearch').addEventListener('input', () => renderOrders(getOrders()));
  $('#orderFilter').addEventListener('change', () => renderOrders(getOrders()));

  const orderModal = $('#adminOrderModal');
  const closeOrderModal = () => orderModal.classList.remove('open');
  $$('[data-close-admin-modal]').forEach((element) => element.addEventListener('click', closeOrderModal));

  const openOrderDetail = (id) => {
    const order = getOrders().find((item) => item.id === id);
    if (!order) return;
    $('#adminOrderDetail').innerHTML = `
      <div class="detail-header"><p class="admin-kicker">Order detail</p><h2>${escapeHtml(order.id)}</h2><p>${escapeHtml(order.customerName || '-')} · ${escapeHtml(order.phone || '-')}</p></div>
      <div class="detail-grid">
        <div class="detail-item"><span>Product</span><strong>${escapeHtml(productLabels[order.product] || order.product)}</strong></div>
        <div class="detail-item"><span>Quantity</span><strong>${Number(order.quantity || 0).toLocaleString('en-MY')}</strong></div>
        <div class="detail-item"><span>Estimate</span><strong>${formatMoney(order.estimate)}</strong></div>
        <div class="detail-item"><span>Due date</span><strong>${formatDate(order.dueDate)}</strong></div>
        <div class="detail-item"><span>Artwork file</span><strong>${escapeHtml(order.fileName || 'Not attached')}</strong></div>
        <div class="detail-item"><span>Payment</span><strong>${escapeHtml(order.paymentStatus || 'Belum disahkan')}</strong></div>
        <div class="detail-item"><span>Source</span><strong>${escapeHtml(order.source || 'Manual')}</strong></div>
        <div class="detail-item"><span>Notes</span><strong>${escapeHtml(order.notes || '-')}</strong></div>
      </div>
      <div class="status-control"><label>Update production status</label><div class="status-buttons">${STATUS_STEPS.map((status, index) => `<button class="${index === Number(order.statusIndex) ? 'active' : ''}" data-set-status="${index}" data-order-id="${escapeHtml(order.id)}">${status}</button>`).join('')}</div></div>
      <div class="detail-actions"><button class="danger-button" data-delete-order="${escapeHtml(order.id)}">Delete order</button><button class="admin-primary-btn" data-mark-paid="${escapeHtml(order.id)}">Mark as paid</button></div>
    `;
    orderModal.classList.add('open');

    $$('[data-set-status]', $('#adminOrderDetail')).forEach((button) => button.addEventListener('click', () => {
      const orders = getOrders();
      const target = orders.find((item) => item.id === button.dataset.orderId);
      if (!target) return;
      const index = Number(button.dataset.setStatus);
      target.statusIndex = index;
      target.status = STATUS_STEPS[index];
      target.updatedAt = new Date().toISOString();
      saveOrders(orders);
      openOrderDetail(target.id);
      renderAll();
      showToast(`Status updated to ${target.status}.`);
    }));

    $('[data-delete-order]', $('#adminOrderDetail')).addEventListener('click', (event) => {
      const idToDelete = event.currentTarget.dataset.deleteOrder;
      if (!confirm(`Delete ${idToDelete}?`)) return;
      saveOrders(getOrders().filter((item) => item.id !== idToDelete));
      closeOrderModal();
      renderAll();
      showToast('Order deleted.');
    });

    $('[data-mark-paid]', $('#adminOrderDetail')).addEventListener('click', (event) => {
      const orders = getOrders();
      const target = orders.find((item) => item.id === event.currentTarget.dataset.markPaid);
      if (!target) return;
      target.paymentStatus = 'Paid';
      target.updatedAt = new Date().toISOString();
      saveOrders(orders);
      openOrderDetail(target.id);
      renderAll();
      showToast('Payment marked as paid.');
    });
  };

  const newOrderModal = $('#newOrderModal');
  $('#newOrderBtn').addEventListener('click', () => newOrderModal.classList.add('open'));
  $$('[data-close-new-order]').forEach((element) => element.addEventListener('click', () => newOrderModal.classList.remove('open')));
  $('#newOrderForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const order = {
      id: generateOrderId(),
      ...data,
      quantity: Number(data.quantity),
      estimate: Number(data.estimate),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: STATUS_STEPS[0],
      statusIndex: 0,
      paymentStatus: 'Belum disahkan',
      source: 'Manual',
      fileName: 'Not attached',
      urgency: 'normal'
    };
    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);
    event.currentTarget.reset();
    newOrderModal.classList.remove('open');
    renderAll();
    showToast(`Order ${order.id} created.`);
  });

  $('#seedOrders').addEventListener('click', () => {
    const existing = getOrders();
    saveOrders([...sampleOrders(), ...existing]);
    renderAll();
    showToast('Sample orders added.');
  });

  $('#exportCsv').addEventListener('click', () => {
    const orders = getOrders();
    if (!orders.length) return showToast('No orders to export.');
    const headers = ['Order ID', 'Customer', 'Phone', 'Product', 'Quantity', 'Status', 'Payment', 'Estimate', 'Due Date'];
    const rows = orders.map((order) => [order.id, order.customerName, order.phone, productLabels[order.product], order.quantity, order.status, order.paymentStatus, order.estimate, order.dueDate]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `am-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported.');
  });

  $('#addWorker').addEventListener('click', () => {
    const name = prompt('Worker name');
    if (!name) return;
    const task = prompt('Task', 'Fold & pack sampul') || 'General production';
    const workers = ensureWorkers();
    workers.push({ id: Date.now(), name, task, target: 500, completed: 0, rate: 0.08 });
    localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
    renderWorkers();
    showToast('Worker added.');
  });

  $('#saveSettings').addEventListener('click', (event) => {
    const card = event.currentTarget.closest('.settings-card');
    const inputs = $$('input', card).map((input) => input.value);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(inputs));
    showToast('Settings saved locally.');
  });

  $('#clearOrders').addEventListener('click', () => {
    if (!confirm('Clear all orders stored in this browser?')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    showToast('Browser orders cleared.');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeOrderModal();
      newOrderModal.classList.remove('open');
      $('#adminSidebar').classList.remove('open');
    }
  });

  populateFilter();
  ensureWorkers();
  renderAll();
})();
