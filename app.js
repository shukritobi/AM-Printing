(() => {
  const STORAGE_KEY = 'am_orders_v1';
  const WAITLIST_KEY = 'am_waitlist_v1';
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
    bulk: 'Bulk / Corporate Order'
  };

  const productPricing = {
    'sampul-raya': { base: 4, unit: 0.42, minimum: 4 },
    stickers: { base: 6.9, unit: 0.18, minimum: 6.9 },
    'photo-4r': { base: 5, unit: 1.15, minimum: 5 },
    polaroid: { base: 8, unit: 0.85, minimum: 8 },
    cards: { base: 10, unit: 0.32, minimum: 10 },
    bulk: { base: 25, unit: 0.25, minimum: 25 }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const getOrders = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  };

  const saveOrders = (orders) => localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));

  const formatMoney = (value) => new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', minimumFractionDigits: 2
  }).format(Number(value || 0));

  const showToast = (message) => {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const generateOrderId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `AM${yy}${mm}${dd}-${random}`;
  };

  const menuToggle = $('#menuToggle');
  const siteNav = $('#siteNav');
  menuToggle?.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  $$('#siteNav a, #siteNav button').forEach((el) => el.addEventListener('click', () => {
    siteNav?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }));

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 })
    : null;

  $$('.reveal').forEach((element) => observer ? observer.observe(element) : element.classList.add('visible'));

  const modal = $('#orderModal');
  const orderForm = $('#orderForm');
  const orderSuccess = $('#orderSuccess');
  const orderProduct = $('#orderProduct');
  const orderQuantity = $('#orderQuantity');
  const orderSize = $('#orderSize');
  const orderMaterial = $('#orderMaterial');
  const orderArtwork = $('#orderArtwork');
  const orderUrgency = $('#orderUrgency');
  const estimatePrice = $('#estimatePrice');
  let currentStep = 1;
  let latestOrder = null;

  const calculateEstimate = () => {
    if (!orderProduct) return 0;
    const product = orderProduct.value;
    const qty = Math.max(1, Number(orderQuantity.value) || 1);
    const pricing = productPricing[product];
    let value = pricing.base + (qty * pricing.unit);

    const sizeFactor = { small: 0.92, standard: 1, large: 1.25, custom: 1.35 }[orderSize.value] || 1;
    const materialFactor = { standard: 1, premium: 1.25, waterproof: 1.35, custom: 1.2 }[orderMaterial.value] || 1;
    const designFee = { ready: 0, edit: 15, design: 45 }[orderArtwork.value] || 0;
    const urgencyFactor = { normal: 1, priority: 1.15, urgent: 1.3 }[orderUrgency.value] || 1;

    value = (value * sizeFactor * materialFactor * urgencyFactor) + designFee;
    value = Math.max(value, pricing.minimum);
    estimatePrice.textContent = formatMoney(value);
    return Number(value.toFixed(2));
  };

  [orderProduct, orderQuantity, orderSize, orderMaterial, orderArtwork, orderUrgency].forEach((field) => {
    field?.addEventListener('input', calculateEstimate);
    field?.addEventListener('change', calculateEstimate);
  });

  const showStep = (step) => {
    currentStep = Math.min(3, Math.max(1, step));
    $$('.form-step', orderForm).forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.step) === currentStep));
    if (currentStep === 3) renderSummary();
    $('.modal-panel', modal)?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openModal = (product) => {
    if (!modal) return;
    if (product && productLabels[product]) orderProduct.value = product;
    orderForm.hidden = false;
    orderSuccess.hidden = true;
    orderForm.reset();
    orderQuantity.value = product === 'photo-4r' || product === 'polaroid' ? 10 : 100;
    if (product && productLabels[product]) orderProduct.value = product;
    calculateEstimate();
    showStep(1);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => orderProduct.focus(), 120);
  };

  const closeModal = () => {
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  $$('[data-open-order]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.product || '')));
  $$('[data-choose-product]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.chooseProduct)));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

  const validateStep = (step) => {
    const panel = $(`.form-step[data-step="${step}"]`, orderForm);
    if (!panel) return false;
    const requiredFields = $$('input[required], select[required], textarea[required]', panel);
    for (const field of requiredFields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };

  $$('[data-next-step]').forEach((button) => button.addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  }));
  $$('[data-prev-step]').forEach((button) => button.addEventListener('click', () => showStep(currentStep - 1)));

  const orderFormData = () => {
    const formData = new FormData(orderForm);
    const file = $('#artworkFile')?.files?.[0];
    return {
      product: formData.get('product'),
      quantity: Number(formData.get('quantity')),
      size: formData.get('size'),
      material: formData.get('material'),
      artwork: formData.get('artwork'),
      urgency: formData.get('urgency'),
      customerName: String(formData.get('customerName') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      dueDate: formData.get('dueDate'),
      notes: String(formData.get('notes') || '').trim(),
      fileName: file?.name || 'Belum dimuat naik',
      estimate: calculateEstimate()
    };
  };

  const labelValue = (type, value) => {
    const labels = {
      size: { small: 'Small', standard: 'Standard', large: 'Large', custom: 'Custom size' },
      material: { standard: 'Standard', premium: 'Premium', waterproof: 'Waterproof', custom: 'Custom / unsure' },
      artwork: { ready: 'Artwork sudah siap', edit: 'Perlu minor edit', design: 'Perlukan design' },
      urgency: { normal: 'Normal queue', priority: 'Priority', urgent: 'Urgent' }
    };
    return labels[type]?.[value] || value || '-';
  };

  const renderSummary = () => {
    const data = orderFormData();
    $('#orderSummary').innerHTML = `
      <div class="summary-row"><span>Produk</span><strong>${productLabels[data.product]}</strong></div>
      <div class="summary-row"><span>Kuantiti</span><strong>${data.quantity}</strong></div>
      <div class="summary-row"><span>Spesifikasi</span><strong>${labelValue('size', data.size)}, ${labelValue('material', data.material)}</strong></div>
      <div class="summary-row"><span>Artwork</span><strong>${labelValue('artwork', data.artwork)}</strong></div>
      <div class="summary-row"><span>Keutamaan</span><strong>${labelValue('urgency', data.urgency)}</strong></div>
      <div class="summary-row"><span>Pelanggan</span><strong>${data.customerName || '-'}</strong></div>
      <div class="summary-row"><span>Fail</span><strong>${data.fileName}</strong></div>
      <div class="summary-row"><span>Anggaran awal</span><strong>${formatMoney(data.estimate)}</strong></div>
    `;
  };

  orderForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!orderForm.checkValidity()) {
      orderForm.reportValidity();
      return;
    }
    const data = orderFormData();
    latestOrder = {
      id: generateOrderId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: STATUS_STEPS[0],
      statusIndex: 0,
      paymentStatus: 'Belum disahkan',
      source: 'Website'
    };
    const orders = getOrders();
    orders.unshift(latestOrder);
    saveOrders(orders);

    orderForm.hidden = true;
    orderSuccess.hidden = false;
    $('#successOrderId').textContent = latestOrder.id;
    const emailSubject = encodeURIComponent(`Tempahan ${latestOrder.id} - ${productLabels[latestOrder.product]}`);
    const emailBody = encodeURIComponent([
      `Assalamualaikum A&M Craft & Brew,`,
      `Saya telah menghantar tempahan melalui website.`,
      `Order ID: ${latestOrder.id}`,
      `Nama: ${latestOrder.customerName}`,
      `Produk: ${productLabels[latestOrder.product]}`,
      `Kuantiti: ${latestOrder.quantity}`,
      `Anggaran awal: ${formatMoney(latestOrder.estimate)}`,
      `No. telefon: ${latestOrder.phone}`,
      `Nota: ${latestOrder.notes || '-'}`
    ].join('\n'));
    $('#emailOrderLink').href = `mailto:amcraftbrew@gmail.com?subject=${emailSubject}&body=${emailBody}`;
    showToast('Tempahan berjaya direkodkan pada peranti ini.');
  });

  $('#copyOrderId')?.addEventListener('click', async () => {
    if (!latestOrder) return;
    try {
      await navigator.clipboard.writeText(latestOrder.id);
      showToast('Nombor order disalin.');
    } catch {
      showToast(`Order ID: ${latestOrder.id}`);
    }
  });

  const trackForm = $('#trackForm');
  trackForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = String(new FormData(trackForm).get('trackId') || '').trim().toUpperCase();
    const result = $('#trackResult');
    if (!id) {
      result.innerHTML = '<span>Sila masukkan nombor order.</span>';
      return;
    }
    const order = getOrders().find((item) => item.id.toUpperCase() === id);
    if (!order) {
      result.innerHTML = '<strong>Order tidak ditemui</strong><span>Pastikan nombor order betul. Demo ini menyimpan order pada browser yang sama sahaja.</span>';
      return;
    }
    const percent = Math.round(((Number(order.statusIndex) + 1) / STATUS_STEPS.length) * 100);
    result.innerHTML = `
      <strong>${order.id}, ${order.status}</strong>
      <span>${productLabels[order.product]} × ${order.quantity}. Dikemas kini ${new Date(order.updatedAt).toLocaleString('ms-MY')}.</span>
      <div class="progress-line"><i style="width:${percent}%"></i></div>
    `;
  });

  $('#waitlistForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    let list = [];
    try { list = JSON.parse(localStorage.getItem(WAITLIST_KEY)) || []; } catch { list = []; }
    list.unshift({ ...data, createdAt: new Date().toISOString() });
    localStorage.setItem(WAITLIST_KEY, JSON.stringify(list));
    event.currentTarget.reset();
    showToast('Nama anda telah dimasukkan ke waiting list pada peranti ini.');
  });

  $('#year').textContent = new Date().getFullYear();
  calculateEstimate();
})();
