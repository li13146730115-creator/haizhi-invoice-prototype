/* 本地交互原型：数据仅在当前页面内存中，邮件由开票人员线下发送。 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => (n / 100).toFixed(2);
  const now = () => new Date().toLocaleString('sv-SE', {timeZone:'Asia/Shanghai'}).slice(0,16);
  const emailValid = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const initial = () => ({
    orders: [
      {id:'XF202610260005',name:'冰美式 × 2',merchant:'园区咖啡',amount:4800,time:'2026-10-26 10:24',status:'none'},
      {id:'XF202610260004',name:'拿铁 × 1',merchant:'园区咖啡',amount:2800,time:'2026-10-26 09:12',status:'none'},
      {id:'XF202610250003',name:'午餐套餐 × 1',merchant:'园区食堂',amount:3200,time:'2026-10-25 12:08',status:'none'},
      {id:'XF202610240002',name:'园区文创礼盒 × 1',merchant:'园区便利店',amount:12800,time:'2026-10-24 15:16',status:'pending',record:'KP202610240003'},
      {id:'XF202610230001',name:'咖啡茶歇套餐 × 1',merchant:'园区咖啡',amount:19800,time:'2026-10-23 14:30',status:'issued',record:'KP202610230002'},
      {id:'XF202610220001',name:'午餐套餐 × 1',merchant:'园区食堂',amount:3600,time:'2026-10-22 12:05',status:'issued',record:'KP202610220001'},
      {id:'XF202610210001',name:'午餐套餐 × 1',merchant:'园区食堂',amount:3200,time:'2026-10-21 12:05',status:'refunded'}
    ],
    records: [
      {id:'KP202610240003',time:'2026-10-24 15:30',merchant:'园区便利店',orders:['XF202610240002'],amount:12800,type:'company',title:'示例科技有限公司',tax:'91110108MA00DEMO01',email:'',status:'pending'},
      {id:'KP202610230002',time:'2026-10-23 15:00',merchant:'园区咖啡',orders:['XF202610230001'],amount:19800,type:'company',title:'示例科技有限公司',tax:'91110108MA00DEMO01',email:'invoice@example.com',status:'issued',method:'upload',file:{name:'电子发票_演示样张.pdf',url:'./电子发票_演示样张.pdf',type:'application/pdf'},invoiceNo:'DEMO202610230002',issuedAt:'2026-10-24 09:15',note:'电子发票已上传，请下载查收。'},
      {id:'KP202610220001',time:'2026-10-22 12:30',merchant:'园区食堂',orders:['XF202610220001'],amount:3600,type:'person',title:'张小海',tax:'',email:'xiaohai@example.com',status:'issued',method:'email',sentEmail:'xiaohai@example.com',invoiceNo:'DEMO202610220001',issuedAt:'2026-10-23 10:10',note:'已通过工作邮箱线下发送。'}
    ]
  });
  const titles = [{id:'company',type:'company',name:'示例科技有限公司',tax:'91110108MA00DEMO01'}, {id:'person',type:'person',name:'张小海',tax:''}];
  let data=initial(), role='user', page='orders', filter='all', selected=new Set(), activeRecord='', successIds=[], error='', modal='', adminQuery='', adminStatus='all', form={type:'company',titleId:'company',title:'示例科技有限公司',tax:'91110108MA00DEMO01',email:'',address:'',phone:'',bank:'',account:''}, process={method:'upload',file:null,status:'issued',invoiceNo:'',email:'',sent:false,note:''};
  let toastTimer, editingResult=false, invoiceBack='records';
  const selectedOrders=()=>data.orders.filter(o=>selected.has(o.id)&&o.status==='none');
  const total=rows=>rows.reduce((s,o)=>s+o.amount,0);
  const statusText=s=>({none:'可开票',pending:'待开票',issued:'已开票',refunded:'已退款'})[s];
  const pill=s=>`<span class="pill ${s==='issued'?'done':s==='pending'?'pending':s==='refunded'?'grey':''}">${statusText(s)}</span>`;
  const methodText=m=>({upload:'在线上传',email:'邮箱发送',status:'仅更新状态'})[m]||'—';
  const kv=(k,v)=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`;
  const notice=(s,neutral=false)=>`<div class="notice ${neutral?'neutral':''}">${s}</div>`;
  const err=()=>error?`<div class="error" role="alert">${esc(error)}</div>`:'';
  const notify=s=>{ $('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3400); };
  const current=()=>data.records.find(r=>r.id===activeRecord);
  function navigate(p){error='';if(p==='invoice'&&!(current()?.status==='issued'&&current()?.method==='upload'&&current()?.file)){activeRecord=data.records.find(r=>r.status==='issued'&&r.method==='upload'&&r.file)?.id||'';}page=p;render();}
  function shell(title,body,footer='',back='orders',right=''){
    return `<div class="phone"><div class="phone-top"><span>9:41</span><span>5G</span></div><div class="phone-bar"><button data-go="${back}" aria-label="返回上一级">返回</button><b>${title}</b>${right?`<button data-action="start">${right}</button>`:'<span></span>'}</div><div class="phone-body">${body}</div><div class="phone-footer ${page==='select'?'split':''}">${footer}</div></div>`;
  }
  function orderPage(){
    const rows=data.orders.filter(o=>filter==='all'||(filter==='none'?o.status==='none':filter==='pending'?o.status==='pending':o.status==='issued'));
    return shell('我的订单',notice('可从已完成的消费订单申请开票。')+`<div class="tabs">${[['all','全部'],['none','可开票'],['pending','待开票'],['issued','已开票']].map(([v,t])=>`<button data-filter="${v}" class="${filter===v?'active':''}">${t}</button>`).join('')}</div>`+(rows.length?rows.map(o=>`<section class="card"><div class="order-head"><b>${esc(o.merchant)}</b>${pill(o.status)}</div><div class="order-name">${esc(o.name)}</div><div class="order-meta">${o.time}<br>${o.id}</div><div class="order-bottom"><strong class="money">¥${money(o.amount)}</strong>${o.status==='none'?`<button data-start-order="${o.id}">申请开票</button>`:o.status!=='refunded'?`<button data-record="${o.record}">${o.status==='issued'?'查看发票':'查看进度'}</button>`:'<small>退款订单不支持开票</small>'}</div></section>`).join(''):'<div class="empty">暂无符合条件的订单</div>'),'<button class="primary" data-action="start">选择订单，申请开票</button>','orders','申请开票');
  }
  function selectPage(){
    const rows=data.orders.filter(o=>o.status==='none'),chosen=selectedOrders();
    return shell('选择开票订单',notice('支持多选；不同开票商户的订单将分别生成申请。')+`<div class="subhead"><span>可开票订单 · ${rows.length} 笔</span><label><input class="checkbox" id="all-orders" type="checkbox" aria-label="全选可开票订单" ${chosen.length&&chosen.length===rows.length?'checked':''} ${!rows.length?'disabled':''}> 全选</label></div>`+(rows.length?rows.map(o=>`<section class="card"><label class="selection"><input type="checkbox" class="checkbox" data-select="${o.id}" aria-label="选择${esc(o.name)}" ${selected.has(o.id)?'checked':''}><div><div class="row"><b>${esc(o.merchant)}</b><strong>¥${money(o.amount)}</strong></div><div style="font-size:12px;margin-top:7px">${esc(o.name)}</div><div class="order-meta" style="margin-bottom:0">${o.time}<br>${o.id}</div></div></label></section>`).join(''):'<div class="empty">暂无可开票订单</div>'),`<div><small>已选 ${chosen.length} 笔 · 合计</small><strong>¥${money(total(chosen))}</strong></div><button class="primary" data-action="next" ${!chosen.length?'disabled':''}>下一步</button>`);
  }
  function applicationPage(){
    const rows=selectedOrders(),merchantCount=new Set(rows.map(o=>o.merchant)).size;
    return shell('填写开票信息',`<div class="stepper"><span class="active">01 选择订单</span><span class="active">02 开票信息</span><span>03 提交申请</span></div>${err()}<section class="card"><h3>发票抬头 <small>电子普通发票</small></h3><div class="type-switch"><button data-type="person" class="${form.type==='person'?'active':''}">个人</button><button data-type="company" class="${form.type==='company'?'active':''}">企业</button></div><div class="field"><label for="title-choice">选择发票抬头</label><select id="title-choice">${titles.filter(t=>t.type===form.type).map(t=>`<option value="${t.id}" ${form.titleId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}<option value="new" ${form.titleId==='new'?'selected':''}>新增${form.type==='person'?'个人':'企业'}抬头</option></select></div><div class="field"><label for="title-name">${form.type==='company'?'企业名称':'个人姓名'} <em>*</em></label><input id="title-name" data-form="title" value="${esc(form.title)}" placeholder="请输入${form.type==='company'?'完整企业名称':'个人姓名'}"></div>${form.type==='company'?`<div class="field"><label for="tax">纳税人识别号 <em>*</em></label><input id="tax" data-form="tax" value="${esc(form.tax)}" placeholder="请输入纳税人识别号"></div><details><summary style="font-size:11px;color:var(--muted);cursor:pointer">更多抬头信息（选填）</summary>${[['address','注册地址'],['phone','联系电话'],['bank','开户银行'],['account','银行账户']].map(([k,n])=>`<div class="field"><label for="${k}">${n}</label><input id="${k}" data-form="${k}" value="${esc(form[k])}"></div>`).join('')}</details>`:''}</section><section class="card"><h3>接收信息</h3><div class="field"><label for="email">接收邮箱 <small>（非必填）</small></label><input id="email" data-form="email" type="email" value="${esc(form.email)}" placeholder="填写用于接收发票的邮箱"><small>不填写也可提交。开票完成后，可在申请详情中查看交付结果。</small></div></section><section class="card"><h3>开票订单 <small>${rows.length} 笔</small></h3>${rows.map(o=>kv(esc(o.merchant)+' · '+esc(o.name),'¥'+money(o.amount))).join('')}<div class="order-bottom"><small>${merchantCount} 个开票商户</small><strong style="color:var(--primary)">¥${money(total(rows))}</strong></div></section>`,`<button class="primary" data-action="confirm-application" ${!rows.length?'disabled':''}>确认信息并提交</button>`,'select');
  }
  function successPage(){
    const records=data.records.filter(r=>successIds.includes(r.id));
    return shell('提交成功',`<div class="status-hero"><span class="status-label">申请已受理</span><h2>开票申请已提交</h2><p>开票人员将在线下开具发票<br>可在“开票记录”中查看最新进度</p></div><section class="card">${kv('申请数量',`${records.length} 条`)}${kv('开票金额',`<b>¥${money(total(records))}</b>`)}${kv('发票抬头',esc(form.title))}${kv('接收邮箱',esc(form.email)||'未填写')}</section>${records.map(r=>`<section class="card"><div class="row"><b style="font-size:12px">${esc(r.merchant)}</b>${pill(r.status)}</div><p style="font-size:10px;color:var(--muted)">${r.id}</p><button class="text" data-record="${r.id}">查看申请详情</button></section>`).join('')}`,`<button class="primary" data-go="records">查看开票记录</button>`);
  }
  function recordsPage(){
    return shell('开票记录',notice('线上查看发票，或按记录中的邮箱查收。')+(data.records.length?data.records.map(r=>`<section class="card"><div class="order-head"><b>${esc(r.merchant)}</b>${pill(r.status)}</div><div class="order-name">${esc(r.title)}</div><div class="order-meta">${r.time}<br>${r.id}</div><div class="order-bottom"><strong>¥${money(r.amount)}</strong><button data-record="${r.id}">${r.status==='issued'&&r.method==='upload'&&r.file?'查看发票':r.status==='issued'?'查看结果':'查看进度'}</button></div>${r.status==='issued'?`<div class="subhead" style="margin-bottom:0">${methodText(r.method)}${r.method==='status'?' · 待交付发票':''}</div>`:''}</section>`).join(''):'<div class="empty">暂无开票记录</div>'),'<button class="primary" data-action="start">申请开票</button>');
  }
  function delivery(r){
    if(r.status!=='issued') return notice('申请已提交，等待开票人员线下开票。开票完成后，这里将展示交付结果。',true);
    if(r.method==='upload') return `<section class="card"><h3>发票文件 <span class="pill done">可查看 / 下载</span></h3><div class="file-box">${esc(r.file.name)}<div class="file-actions"><button class="text" data-${role==='user'?'open-invoice':'preview'}="${r.id}">查看发票</button><a href="${esc(r.file.url)}" download="${esc(r.file.name)}">下载发票</a></div></div><p style="font-size:10px;color:var(--muted)">请下载保存发票，用于后续报销或留存。</p></section>`;
    if(r.method==='email')return `<section class="card"><div class="delivery-title">发票已通过邮箱发送</div><p style="font-size:12px">请前往以下邮箱查收发票：</p><div class="notice" style="overflow-wrap:anywhere">${esc(r.sentEmail)}</div><small>开票人员已登记线下发送完成。如未收到，请检查垃圾邮件，或联系开票方核实。</small></section>`;
    return `<section class="card"><h3>发票已开具，待交付</h3><p style="font-size:12px;color:var(--muted)">开票方已更新开票状态，暂未登记在线文件或邮箱发送结果。</p>${notice('请联系开票方获取发票，或等待开票方补充交付结果。',true)}</section>`;
  }
  function resultPage(){
    const r=current();if(!r)return recordsPage();
    return shell('开票申请详情',`<div class="status-hero"><span class="status-label" style="color:${r.status==='pending'?'var(--orange)':'var(--green)'}">${statusText(r.status)}</span><h2>${r.status==='pending'?'等待开票':'开票已完成'}</h2><div class="amount">¥${money(r.amount)}</div></div><div class="stepper"><span class="active">申请已提交</span><span class="active">${r.status==='pending'?'等待线下开票':'线下开票完成'}</span><span class="${r.status==='issued'?'active':''}">开票结果</span></div>${delivery(r)}<section class="card"><h3>开票信息</h3>${recordInfo(r)}${r.status==='issued'?kv('开票时间',esc(r.issuedAt))+kv('交付方式',methodText(r.method))+(r.invoiceNo?kv('发票号码',esc(r.invoiceNo)):''):''}${r.note?kv('开票方备注',esc(r.note)):''}</section><section class="card"><h3>关联订单 · ${r.orders.length} 笔</h3>${r.orders.map(id=>{const o=data.orders.find(o=>o.id===id);return kv(esc(o?.name||id),`¥${money(o?.amount||0)}`)}).join('')}</section>`,`<button data-go="records">返回开票记录</button>`,'records');
  }
  function invoicePage(){
    const r=current();
    if(!r||r.status!=='issued'||r.method!=='upload'||!r.file)return shell('查看发票',notice('当前暂无可在线查看的发票文件，请返回开票记录查看交付结果。',true),'<button data-go="records">返回开票记录</button>','records');
    const f=r.file,isImage=/image\//.test(f.type)||/\.(png|jpe?g)$/i.test(f.name),isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
    return shell('查看发票',`<section class="card invoice-summary"><div class="row"><b>电子发票</b>${pill(r.status)}</div><div class="invoice-value">¥${money(r.amount)}</div><div class="invoice-title">${esc(r.title)}</div><small>${esc(r.merchant)} · ${esc(r.issuedAt)}</small></section><section class="card invoice-file-card"><h3>发票文件 <small>${isPdf?'PDF':isImage?'图片':'OFD'} 文件</small></h3><div class="invoice-filename">${esc(f.name)}</div><div class="invoice-file-toolbar"><span>文件预览</span>${isPdf||isImage?`<button class="text" data-preview="${r.id}">放大查看</button>`:''}</div>${isPdf?'<div id="invoice-pdf-pages" class="pdf-pages invoice-pages" aria-label="发票文件预览"><p role="status">正在载入发票…</p></div>':isImage?`<div class="invoice-image-wrap"><img class="invoice-image" src="${esc(f.url)}" alt="已开具的发票文件"></div>`:notice('OFD 文件请下载后使用兼容阅读器查看。',true)}<p class="invoice-help">下载后可保存原始文件，用于报销或留存。</p></section><section class="card"><h3>发票信息</h3>${kv('发票号码',esc(r.invoiceNo)||'未填写')}${kv('发票抬头',esc(r.title))}${r.type==='company'?kv('纳税人识别号',esc(r.tax)):''}${kv('开票金额','¥'+money(r.amount))}${kv('开票时间',esc(r.issuedAt))}<button class="text" data-go="result">查看关联申请与订单</button></section>`,`<a class="primary invoice-download" href="${esc(f.url)}" download="${esc(f.name)}">下载发票文件</a>`,invoiceBack);
  }
  function recordInfo(r){return kv('申请编号',esc(r.id))+kv('申请时间',esc(r.time))+kv('开票商户',esc(r.merchant))+kv('抬头类型',r.type==='company'?'企业':'个人')+kv('发票抬头',esc(r.title))+(r.type==='company'?kv('纳税人识别号',esc(r.tax)):'')+[['address','注册地址'],['phone','联系电话'],['bank','开户银行'],['account','银行账户']].filter(([k])=>r[k]).map(([k,n])=>kv(n,esc(r[k]))).join('')+kv('预留邮箱',esc(r.email)||'未填写');}
  function guide(){
    const descriptions={orders:['从订单发起开票','订单列表直接展示开票状态，可单笔发起，也可批量选择。'],select:['选择需要开票的订单','只展示未申请的有效订单；底部实时汇总订单数与金额。'],apply:['确认抬头与接收信息','先选个人或企业，再选择或填写抬头。邮箱选填，不阻断申请。'],success:['申请提交，等待线下开票','提交成功代表申请已进入待办，发起端与开票端共享同一申请状态。'],records:['统一查看开票进度','每条申请保留抬头、订单和开票结果，可随时返回查看。'],invoice:['查看并保存已开票文件','已上传的发票在独立页面直接预览，也可放大查看或下载原始文件。'],result:['按交付方式查收发票','在线上传提供查看和下载；邮箱发送提示实际接收邮箱；仅更新状态时明确标记待交付。']};
    const [title,desc]=descriptions[page]||descriptions.orders;
    return `<aside class="guide"><span class="section-number">APPLICANT / 发起端</span><h2>${title}</h2><p>${desc}</p><div class="guide-block"><h3>完整开票流程</h3>${[['选择订单','勾选需要开票的订单，确认合计金额'],['提交申请','选择个人 / 企业，填写抬头与选填邮箱'],['线下开票','开票人员开具发票并登记交付结果'],['查收发票','在线查看、下载，或到指定邮箱查收']].map(([t,d],i)=>`<div class="flow-item"><span>0${i+1}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div><div class="guide-block"><h3>两端状态同步</h3>${kv('未提交申请','可开票')}${kv('提交申请后','<span class="pill pending">待开票</span>')}${kv('开票方登记结果后','<span class="pill done">已开票</span>')}<button data-role="admin">切换开票端，处理申请</button></div><p class="guide-footer">当前为交互演示，使用示例订单与抬头信息。<br>不连接实际开票或邮件服务，刷新页面后恢复演示数据。</p></aside>`;
  }
  function adminPage(){
    const rows=data.records.filter(r=>(adminStatus==='all'||r.status===adminStatus)&&(!adminQuery||`${r.id} ${r.title} ${r.merchant}`.toLowerCase().includes(adminQuery.toLowerCase())));
    const pending=data.records.filter(r=>r.status==='pending').length;
    return shell('开票申请',`<div class="mobile-admin-summary"><div><small>待开票申请</small><strong>${pending}<span> 条</span></strong></div><p>核对申请，线下开票<br>完成后登记交付结果</p></div><div class="mobile-search"><input id="admin-query" aria-label="搜索开票申请" value="${esc(adminQuery)}" placeholder="搜索申请编号、抬头或商户"><button data-action="search">搜索</button>${adminQuery?'<button class="text" data-action="clear-search">清空</button>':''}</div><div class="tabs admin-tabs">${[['all','全部'],['pending','待开票'],['issued','已开票']].map(([v,t])=>`<button data-admin-filter="${v}" class="${adminStatus===v?'active':''}">${t} <span>${data.records.filter(r=>v==='all'||r.status===v).length}</span></button>`).join('')}</div><div class="subhead"><span>申请列表</span><span>共 ${rows.length} 条</span></div>${rows.map(r=>`<section class="card admin-application"><div class="order-head"><b>${esc(r.merchant)}</b>${pill(r.status)}</div><div class="order-name">${esc(r.title)}</div><div class="order-meta">${r.type==='company'?'企业':'个人'}抬头 · ${r.orders.length} 笔订单<br>申请时间 ${r.time}</div><div class="application-id">${r.id}</div>${r.status==='issued'?`<div class="delivery-meta">交付方式：${methodText(r.method)}${r.method==='status'?' · 待交付':''}</div>`:''}<div class="order-bottom"><strong class="money">¥${money(r.amount)}</strong><button class="${r.status==='pending'?'primary':''}" data-process="${r.id}">${r.status==='pending'?'处理申请':'查看详情'}</button></div></section>`).join('')||'<div class="empty">暂无符合条件的申请</div>'}`, '<div class="mobile-footer-note">线下开票后，请及时提交开票结果</div>','admin');
  }
  function adminGuide(){
    const processing=page==='process', r=current();
    return `<aside class="guide"><span class="section-number">ISSUER / 开票端 · 移动端</span><h2>${processing?(r?.status==='issued'&&!editingResult?'查看开票交付结果':'核对信息，登记开票结果'):'随时处理开票申请'}</h2><p>${processing?'申请信息与交付信息分区展示，底部固定操作按钮，方便手机上核对与提交。':'按状态筛选申请，点击卡片进入处理页；线下开票后，在手机上补充文件或邮箱发送结果。'}</p><div class="guide-block"><h3>移动开票流程</h3>${[['申请列表','搜索抬头、商户或申请编号'],['核对申请','查看开票金额、抬头和关联订单'],['登记结果','上传文件，或确认已线下发送邮箱'],['完成开票','更新已开票，发起端同步查看结果']].map(([t,d],i)=>`<div class="flow-item"><span>0${i+1}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div><div class="guide-block"><h3>交付方式</h3>${kv('在线上传','发起人可查看 / 下载')}${kv('邮箱发送','登记实际地址并确认已线下发送')}${kv('仅更新状态','已开票，待补充交付结果')}<button data-role="user">切换发起端，查看结果</button></div><p class="guide-footer">两端均为移动端页面。当前使用示例数据，<br>不连接实际开票或邮件服务。</p></aside>`;
  }
  function overview(){return `<div class="overview-grid">${[['01','发起开票','订单列表 → 多选订单 → 选择个人 / 企业 → 填写抬头与选填邮箱 → 确认提交','orders','user'],['02','线下处理','查看申请 → 核对抬头与订单 → 线下开票 → 手动选择交付方式 → 更新已开票','admin','admin'],['03','结果查收','上传：在线查看 / 下载；邮箱：到实际接收地址查收；仅更新状态：提示发票待交付','records','user']].map(([n,t,d,p,r])=>`<section class="card"><span class="section-number" style="color:var(--primary)">${n}</span><h3 style="margin-top:12px">${t}</h3><p>${d}</p><button data-entry="${p}" data-entry-role="${r}">打开页面</button></section>`).join('')}</div><section class="card" style="margin-top:20px"><h3>字段与交付规则</h3>${kv('个人抬头','姓名必填，税号不展示')}${kv('企业抬头','企业名称、纳税人识别号必填；其他信息选填')}${kv('接收邮箱','申请阶段非必填；填写时校验格式')}${kv('在线上传','必须上传发票文件；开票后可查看和下载')}${kv('邮箱发送','必须有有效接收邮箱，并确认已在线下发送')}${kv('仅更新状态','只登记已开票；发起端明确提示发票待交付')}${kv('订单约束','已申请 / 已开票不重复申请，退款订单不可申请')}${kv('多商户订单','按开票商户分别生成申请，分别跟踪结果')}</section>`;}
  function render(){
    document.querySelectorAll('.role-switch button').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
    const nav=role==='user'?[['orders','订单列表'],['select','选择开票订单'],['apply','填写开票信息'],['records','开票记录'],['invoice','查看已开票文件'],['overview','流程与规则']]:[['admin','开票申请'],['overview','流程与规则']];
    const titlesMap={orders:['我的订单','从消费订单发起申请，随时查看开票进度'],select:['选择开票订单','支持批量申请，自动汇总开票金额'],apply:['开票申请','确认抬头与接收信息后提交申请'],success:['申请已提交','开票人员将在线下完成开票'],records:['开票记录','申请进度与发票文件统一查看'],invoice:['查看发票','在线预览已开票文件，下载保存原始附件'],result:['开票结果','按实际交付方式查收发票'],admin:['开票申请','在手机上查看申请，登记线下开票与交付结果'],process:['开票处理','核对申请信息，线下开票后提交结果'],overview:['流程与规则','连接申请、线下开票与结果查收']};
    const [title,subtitle]=titlesMap[page]||titlesMap.orders;
    $('#app').innerHTML=`<div class="layout"><nav class="sidebar" aria-label="页面导航"><div class="eyebrow">${role==='user'?'发起端 · 页面':'开票端 · 工作台'}</div>${nav.map(([p,t],i)=>`<button data-go="${p}" class="nav-item ${page===p||p==='records'&&page==='result'||p==='admin'&&page==='process'?'active':''}"><span>0${i+1}</span>${t}</button>`).join('')}<div class="side-note"><b>订单开票闭环</b><p>申请提交<br>线下开票<br>登记交付结果<br>发起人查收</p><span class="pill">交互原型 · V1.0</span></div></nav><main class="content ${page==='overview'?'overview-content':''}"><div class="heading"><div><h1>${title}</h1><p>${subtitle}</p></div><span class="tag">${role==='user'?'发起端 · 移动端':'开票端 · 移动端'}</span></div>${page==='overview'?overview():role==='admin'?`<div class="user-workspace">${page==='process'?processPage():adminPage()}${adminGuide()}</div>`:`<div class="user-workspace">${({orders:orderPage,select:selectPage,apply:applicationPage,success:successPage,records:recordsPage,result:resultPage,invoice:invoicePage}[page]||orderPage)()}${guide()}</div>`}</main></div>`;
    if(page==='invoice'&&$('#invoice-pdf-pages'))renderPdf(current().file.url,'#invoice-pdf-pages');
  }
  function openProcess(id){
    activeRecord=id;const r=current();process={method:r.method||'upload',file:r.file||null,status:'issued',invoiceNo:r.invoiceNo||'',email:r.sentEmail||r.email||'',sent:false,note:r.note||''};error='';drawProcess(false);
  }
  function drawProcess(edit){
    const previous=page==='process'?$('.phone-body')?.scrollTop||0:0;
    editingResult=edit;page='process';render();
    $('.phone-body').scrollTop=previous;
  }
  function processPage(){
    const r=current();if(!r)return adminPage();
    const readonly=r.status==='issued'&&!editingResult;
    const body=`${err()}${notice(readonly?'本申请已完成开票，可查看实际交付结果。':'请先核对信息并在线下开票，再登记开票结果。')}<section class="card"><h3>申请信息 ${pill(r.status)}</h3>${recordInfo(r)}<div class="order-bottom"><small>申请开票金额</small><strong>¥${money(r.amount)}</strong></div></section><section class="card"><h3>关联订单 · ${r.orders.length} 笔</h3>${r.orders.map(id=>{const o=data.orders.find(o=>o.id===id);return `<div style="padding:8px 0">${kv(esc(o?.name||id),'¥'+money(o?.amount||0))}<small>${id}</small></div>`}).join('')}</section>${readonly?`<section class="card"><h3>开票结果</h3>${kv('开票状态','已开票')}${kv('交付方式',methodText(r.method))}${kv('登记时间',esc(r.issuedAt))}${r.invoiceNo?kv('发票号码',esc(r.invoiceNo)):''}${r.note?kv('处理备注',esc(r.note)):''}</section>${delivery(r)}`:`<section class="card"><h3>登记开票结果</h3><div class="field"><label for="invoice-no">发票号码 <small>（选填）</small></label><input id="invoice-no" data-process-field="invoiceNo" value="${esc(process.invoiceNo)}" placeholder="请输入线下开具的发票号码"></div><div class="field"><label>交付方式 <em>*</em></label><div class="radio-line">${[['upload','在线上传'],['email','邮箱发送'],['status','仅更新状态']].map(([v,n])=>`<label><input type="radio" name="method" value="${v}" ${process.method===v?'checked':''}>${n}</label>`).join('')}</div></div>${process.method==='upload'?`<div class="upload">上传已开具的发票文件<small>支持 PDF、OFD、JPG、PNG，单个文件不超过 10MB</small><input type="file" id="invoice-file" aria-label="上传发票文件" accept=".pdf,.ofd,.jpg,.jpeg,.png"><div style="margin-top:8px"><button class="text" data-action="sample-file">使用演示发票文件</button></div></div>${process.file?`<div class="file-box row"><span>${esc(process.file.name)}</span><button class="text" data-action="remove-file">移除</button></div>`:''}`:process.method==='email'?`<div class="field"><label for="actual-email">实际接收邮箱 <em>*</em></label><input id="actual-email" data-process-field="email" type="email" value="${esc(process.email)}" placeholder="申请未留邮箱时，请联系申请人补充"><small>请在线下通过工作邮箱发送，系统仅记录发送结果。</small></div><label style="font-size:12px;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" class="checkbox" id="sent-confirm" ${process.sent?'checked':''}>我已在线下将发票发送至上述邮箱</label>`:notice('仅登记“已开票”，不会提供下载或标记邮箱已发送。发起端将看到“发票已开具，待交付”。',true)}<div class="field"><label for="result-status">开票状态 <em>*</em></label><select id="result-status" data-process-field="status"><option value="">请选择开票状态</option><option value="issued" ${process.status==='issued'?'selected':''}>已开票</option></select></div><div class="field"><label for="process-note">处理备注 <small>（选填，申请人可见）</small></label><textarea id="process-note" data-process-field="note" placeholder="可补充发票交付说明">${esc(process.note)}</textarea></div></section>`}`;
    return shell(readonly?'开票详情':'处理开票申请',body,readonly?'<button class="primary" data-action="edit-delivery">补充 / 修改交付结果</button>':'<button class="primary" data-action="save-result">确认提交开票结果</button>','admin');
  }
  function closeModal(){modal='';error='';$('#overlay').innerHTML='';}
  function confirmApplication(){
    error='';if(!selectedOrders().length)error='请先选择可开票订单。';else if(!form.title.trim())error=`请输入${form.type==='company'?'企业名称':'个人姓名'}。`;else if(form.type==='company'&&!form.tax.trim())error='请输入纳税人识别号。';else if(form.email.trim()&&!emailValid(form.email.trim()))error='请填写有效的接收邮箱，或留空后提交。';
    if(error){render();$('.phone-body').scrollTop=0;return;}
    modal='confirm';$('#overlay').innerHTML=`<div class="scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="确认开票申请"><h2>确认提交开票申请？</h2><p>提交后将由开票人员线下开票，请核对以下信息。</p>${kv('抬头类型',form.type==='company'?'企业':'个人')}${kv('发票抬头',esc(form.title))}${form.type==='company'?kv('纳税人识别号',esc(form.tax)):''}${kv('接收邮箱',esc(form.email)||'未填写')}${kv('订单数量',selectedOrders().length+' 笔')}${kv('开票金额',`<b>¥${money(total(selectedOrders()))}</b>`)}<div class="actions"><button data-action="close">返回修改</button><button class="primary" data-action="submit-application">确认提交</button></div></section></div>`;
  }
  function submitApplication(){
    const rows=selectedOrders();if(!rows.length||modal!=='confirm')return;const merchants=[...new Set(rows.map(o=>o.merchant))];successIds=[];
    merchants.forEach((merchant,i)=>{const orders=rows.filter(o=>o.merchant===merchant);const id=`KP${Date.now()}${i}`;successIds.push(id);data.records.unshift({id,time:now(),merchant,orders:orders.map(o=>o.id),amount:total(orders),type:form.type,title:form.title.trim(),tax:form.type==='company'?form.tax.trim():'',email:form.email.trim(),address:form.type==='company'?form.address.trim():'',phone:form.type==='company'?form.phone.trim():'',bank:form.type==='company'?form.bank.trim():'',account:form.type==='company'?form.account.trim():'',status:'pending'});orders.forEach(o=>{o.status='pending';o.record=id;});});selected.clear();closeModal();navigate('success');notify('申请已提交，等待开票');
  }
  function saveResult(){
    error='';if(process.status!=='issued')error='请选择“已开票”状态。';else if(process.method==='upload'&&!process.file)error='请上传已开具的发票文件。';else if(process.method==='email'&&!emailValid(process.email.trim()))error='请补充有效的实际接收邮箱。';else if(process.method==='email'&&!process.sent)error='请先在线下发送发票，并勾选发送确认。';
    if(error){drawProcess(true);$('.phone-body').scrollTop=0;return;}
    const r=current();Object.assign(r,{status:'issued',method:process.method,file:process.method==='upload'?process.file:null,sentEmail:process.method==='email'?process.email.trim():'',issuedAt:now(),invoiceNo:process.invoiceNo.trim(),note:process.note.trim()});r.orders.forEach(id=>{const o=data.orders.find(o=>o.id===id);if(o)o.status='issued';});editingResult=false;closeModal();navigate('process');notify('开票结果已提交，发起端状态已同步');
  }
  function preview(id){
    const r=data.records.find(r=>r.id===id);if(!r?.file)return;
    const f=r.file,isImage=/image\//.test(f.type)||/\.(png|jpe?g)$/i.test(f.name),isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);modal='preview';
    $('#overlay').innerHTML=`<div class="scrim"><section class="modal" style="width:min(820px,calc(100% - 30px))" role="dialog" aria-modal="true" aria-label="发票预览"><div class="row"><h2>发票预览</h2><button class="close" data-action="close">关闭</button></div><p>${esc(f.name)}</p>${isImage?`<img src="${esc(f.url)}" alt="上传的发票" style="max-width:100%;max-height:58vh;object-fit:contain">`:isPdf?'<div id="pdf-pages" class="pdf-pages" aria-label="发票内容"><p role="status">正在载入发票…</p></div>':notice('OFD 文件请下载后使用兼容阅读器查看。',true)}<div class="actions"><a href="${esc(f.url)}" download="${esc(f.name)}">下载发票文件</a></div></section></div>`;
    $('#overlay .close').focus();
    if(isPdf)renderPdf(f.url);
  }
  async function renderPdf(url,selector='#pdf-pages'){
    const host=$(selector);if(!host)return;
    try {
      const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.min.mjs';
      const pdf=await pdfjs.getDocument({url,cMapUrl:'./vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'./vendor/pdfjs/standard_fonts/',wasmUrl:'./vendor/pdfjs/wasm/'}).promise;
      if(!host.isConnected)return;
      host.innerHTML='';
      for(let i=1;i<=pdf.numPages;i++){
        if(!host.isConnected)break;
        const pdfPage=await pdf.getPage(i),view=pdfPage.getViewport({scale:1.5});
        const canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;canvas.setAttribute('aria-label',`发票第 ${i} 页`);canvas.setAttribute('role','img');host.append(canvas);
        await pdfPage.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
      }
    } catch {
      if(host.isConnected)host.innerHTML=notice('当前文件无法在线预览，请下载后查看。',true);
    }
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.role){role=b.dataset.role;modal='';closeModal();navigate(role==='admin'?'admin':'orders');return;}
    if(b.dataset.go){let p=b.dataset.go;if(['apply'].includes(p)&&!selectedOrders().length){p='select';notify('请先选择需要开票的订单');}navigate(p);return;}
    if(b.dataset.entry){role=b.dataset.entryRole;navigate(b.dataset.entry);return;}
    if(b.dataset.adminFilter){adminStatus=b.dataset.adminFilter;render();return;}
    if(b.dataset.filter){filter=b.dataset.filter;render();return;}
    if(b.dataset.startOrder){selected=new Set([b.dataset.startOrder]);navigate('select');return;}
    if(b.dataset.record){invoiceBack=page==='orders'?'orders':'records';activeRecord=b.dataset.record;const r=current();navigate(r?.status==='issued'&&r.method==='upload'&&r.file?'invoice':'result');return;}
    if(b.dataset.openInvoice){invoiceBack='result';activeRecord=b.dataset.openInvoice;navigate('invoice');return;}
    if(b.dataset.process){openProcess(b.dataset.process);return;}
    if(b.dataset.preview){preview(b.dataset.preview);return;}
    if(b.dataset.type){form.type=b.dataset.type;const t=titles.find(t=>t.type===form.type);form.titleId=t?.id||'new';form.title=t?.name||'';form.tax=t?.tax||'';error='';render();return;}
    switch(b.dataset.action){
      case 'start':selected.clear();navigate('select');break;
      case 'next':if(selectedOrders().length)navigate('apply');break;
      case 'confirm-application':confirmApplication();break;
      case 'submit-application':submitApplication();break;
      case 'close':closeModal();break;
      case 'sample-file':process.file={name:'电子发票_演示样张.pdf',url:'./电子发票_演示样张.pdf',type:'application/pdf'};error='';drawProcess(true);break;
      case 'remove-file':process.file=null;drawProcess(true);break;
      case 'edit-delivery':drawProcess(true);break;
      case 'save-result':saveResult();break;
      case 'search':adminQuery=$('#admin-query').value.trim();render();break;
      case 'clear-search':adminQuery='';adminStatus='all';render();break;
    }
    if(b.id==='reset'){$('#overlay').innerHTML=`<div class="scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="重置演示"><h2>重置本次演示？</h2><p>当前页中新建的申请和上传文件将清空，恢复示例数据。</p><div class="actions"><button data-action="close">取消</button><button class="primary" id="confirm-reset">确认重置</button></div></section></div>`;modal='reset';}
    if(b.id==='confirm-reset'){data=initial();selected.clear();successIds=[];role='user';filter='all';adminQuery='';adminStatus='all';closeModal();navigate('orders');notify('已恢复演示数据');}
  });
  document.addEventListener('input',e=>{const t=e.target;if(t.dataset.form)form[t.dataset.form]=t.value;if(t.dataset.processField)process[t.dataset.processField]=t.value;});
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.select){t.checked?selected.add(t.dataset.select):selected.delete(t.dataset.select);render();}
    if(t.id==='all-orders'){selected=new Set(t.checked?data.orders.filter(o=>o.status==='none').map(o=>o.id):[]);render();}
    if(t.id==='title-choice'){const title=titles.find(x=>x.id===t.value);form.titleId=t.value;form.title=title?.name||'';form.tax=title?.tax||'';render();}
    if(t.name==='method'){process.method=t.value;error='';drawProcess(true);}
    if(t.id==='result-status')process.status=t.value;
    if(t.id==='sent-confirm')process.sent=t.checked;
    if(t.id==='invoice-file'){
      const file=t.files[0];if(!file)return;
      if(file.size>10*1024*1024){error='文件超过 10MB，请重新选择。';drawProcess(true);return;}
      if(!/\.(pdf|ofd|jpe?g|png)$/i.test(file.name)){error='仅支持 PDF、OFD、JPG 或 PNG 文件。';drawProcess(true);return;}
      process.file={name:file.name,type:file.type,url:URL.createObjectURL(file)};error='';drawProcess(true);
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal)closeModal();if(e.key==='Enter'&&e.target.id==='admin-query'){adminQuery=e.target.value.trim();render();}});
  render();
})();
