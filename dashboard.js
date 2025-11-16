// dashboard.js

// --- 1. Supabase 클라이언트 초기화 ---
// [!!!] 작업 3에서 복사한 여러분의 Supabase URL과 'anon' 키를 여기에 붙여넣으세요.
const SUPABASE_URL = 'https://mmqfwakzuohcjwumnsvm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcWZ3YWt6dW9oY2p3dW1uc3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTQyNzAsImV4cCI6MjA3ODc3MDI3MH0.OjBh1l8U0gULViXcYXV8MYhZ1SzUIsp5NX18WBQvQb0';

// Supabase 클라이언트 생성 (HTML의 <script> 태그로 라이브러리를 이미 로드함)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. HTML 요소 가져오기 ---
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const signupButton = document.getElementById('signup-button');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authMessage = document.getElementById('auth-message');
const welcomeEmail = document.getElementById('welcome-email');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
// ... (welcomeEmail, emailInput, passwordInput 다음)

// API 키 섹션 요소
const createKeyButton = document.getElementById('create-key-button');
const apiKeyDisplay = document.getElementById('api-key-display');
const apiKeyPrompt = document.getElementById('api-key-prompt');
const apiKeyValue = document.getElementById('api-key-value');
const apiKeyMessage = document.getElementById('api-key-message');

// ... (apiKeyMessage 다음)

// v0.4 도메인 섹션 요소
const domainSection = document.getElementById('domain-section');
const domainList = document.getElementById('domain-list');
const domainForm = document.getElementById('domain-form');
const domainInput = document.getElementById('domain-input');
const domainMessage = document.getElementById('domain-message');
const domainLoadingMessage = document.getElementById('domain-loading-message');
const apiKeyLoadingMessage = document.getElementById('api-key-loading-message');

// --- 3. UI 상태 변경 함수 ---
function showDashboard(user) {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  welcomeEmail.textContent = user.email;
}

function showAuthForm() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  welcomeEmail.textContent = '';
}

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.className = isError ? 'error-message' : 'success-message';
}

// --- 4. 인증 이벤트 리스너 ---

// [회원가입] 버튼 클릭
signupButton.addEventListener('click', async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || password.length < 6) {
    showMessage('이메일을 입력하고, 비밀번호는 6자 이상이어야 합니다.', true);
    return;
  }

  showMessage('회원가입 중...');
  
  // Supabase 'Auth'로 회원가입
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    showMessage(`회원가입 실패: ${error.message}`, true);
  } else {
    showMessage('회원가입 성공! 로그인해 주세요.', false);
  }
});

// [로그인] 폼 제출 (폼의 기본 submit 이벤트를 사용)
authForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // 폼이 새로고침되는 것을 막음
  
  const email = emailInput.value;
  const password = passwordInput.value;

  showMessage('로그인 중...');

  // Supabase 'Auth'로 로그인
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    showMessage(`로그인 실패: ${error.message}`, true);
  } else {
    // 로그인은 성공했지만, Supabase가 세션 정보를 가져오는 중...
    // 세션 정보가 준비되면 'checkSession'이 알아서 대시보드를 보여줄 겁니다.
    // (onAuthStateChange 이벤트가 감지합니다)
  }
});

// [로그아웃] 버튼 클릭
logoutButton.addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    alert(`로그아웃 실패: ${error.message}`);
  } else {
    showAuthForm(); // 로그아웃 성공 시 인증 폼 표시
  }
});

// --- 5. 페이지 로드 시 세션 확인 ---
// (가장 중요) 페이지가 로드되거나, 로그인이 감지되면 실행됩니다.
// ...
// ...
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_USER') {
    showDashboard(session.user);
    addApiKeyButtonListener(session); 

    // [!!! v0.4 추가 !!!]
    // 로그인 성공 시, DB에서 내 API 키와 도메인 목록을 불러옵니다.
    loadCustomerData(session.user);

  } else if (event === 'SIGNED_OUT') {
// ...

  } else if (event === 'SIGNED_OUT') {
// ...
    // 로그아웃 되었음!
    showAuthForm();
  }
});

// ... (supabaseClient.auth.onAuthStateChange ... 코드 끝)


// --- 6. API 키 생성 기능 ---

/**
 * API 키를 화면에 표시하는 함수
 */
function displayApiKey(apiKey) {
  apiKeyPrompt.classList.add('hidden');
  apiKeyDisplay.classList.remove('hidden');
  apiKeyValue.textContent = apiKey;
}

/**
 * 'API 키 생성하기' 버튼에 클릭 이벤트를 추가하는 함수
 */
function addApiKeyButtonListener(session) {
  if (!createKeyButton) return;

  createKeyButton.addEventListener('click', async () => {
    try {
      // 0. 버튼 비활성화 및 메시지 표시
      createKeyButton.disabled = true;
      apiKeyMessage.textContent = 'API 키 생성 중... (최대 30초 소요)';
      apiKeyMessage.className = 'success-message';

      // 1. (보안) 현재 로그인한 사용자의 '인증 토큰' 가져오기
      // 이 토큰을 Supabase 함수로 보내 '본인'임을 증명합니다.
      const { data: { session: currentSession }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;

      const userToken = currentSession.access_token;

      // 2. Supabase 함수('create-api-key')를 호출합니다.
      const { data, error: funcError } = await supabaseClient.functions.invoke(
        'create-api-key', // [!!!] 우리가 배포한 함수의 이름
        {
          // (중요) 'Authorization' 헤더에 토큰을 담아 보냅니다.
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }
      );

      if (funcError) {
        // Supabase 함수 자체가 실패한 경우 (예: 500 오류)
        throw new Error(`함수 호출 실패: ${funcError.message}`);
      }

      if (data.error) {
        // 함수 *내부*에서 오류가 발생한 경우 (예: 인증 실패, DB 오류)
        throw new Error(`API 키 생성 실패: ${data.error}`);
      }

      // 3. 성공!
      const newApiKey = data.apiKey;
      displayApiKey(newApiKey); // 화면에 새 API 키 표시
      apiKeyMessage.textContent = ''; // 성공 시 메시지 숨김

    } catch (error) {
      console.error('API 키 생성 오류:', error);
      apiKeyMessage.textContent = error.message;
      apiKeyMessage.className = 'error-message';
      createKeyButton.disabled = false; // 실패 시 버튼 다시 활성화
    }
  });
}

// ... (addApiKeyButtonListener 함수 끝) ...

// --- 7. (v0.4) 고객 데이터 로드 (API 키, 도메인) ---

/**
 * RLS (행 수준 보안)를 이용해 'customers' 테이블에서
 * 현재 로그인한 사용자의 API 키와 도메인 목록을 가져옵니다.
 */
async function loadCustomerData(user) {
  apiKeyLoadingMessage.classList.remove('hidden');
  domainLoadingMessage.classList.remove('hidden');
  domainSection.classList.add('hidden');

  try {
    // 1. (보안) Supabase는 RLS 덕분에 'auth.uid() = user_id' 조건에
    // 맞는 데이터만 자동으로 반환합니다.
    const { data, error } = await supabaseClient
      .from('customers')          // 'customers' 테이블에서
      .select('api_key, allowed_domain') // 이 두 컬럼을 선택
      .single();                  // 단 하나의 줄(row)만 가져옴

    if (error && error.code !== 'PGRST116') {
      // 'PGRST116'는 "결과 없음(0건)" 오류입니다. 이건 정상입니다.
      // 그 외의 DB 오류는 여기서 처리합니다.
      throw new Error(`DB 조회 실패: ${error.message}`);
    }

    if (data) {
      // --- 2. 고객 데이터가 있는 경우 (키 이미 발급) ---
      displayApiKey(data.api_key); // API 키 표시
      renderDomainList(data.allowed_domain || []); // 도메인 목록 표시

      apiKeyLoadingMessage.classList.add('hidden');
      domainLoadingMessage.classList.add('hidden');
      domainSection.classList.remove('hidden');

    } else {
      // --- 3. 고객 데이터가 없는 경우 (신규 가입) ---
      apiKeyLoadingMessage.classList.add('hidden');
      apiKeyPrompt.classList.remove('hidden'); // 'API 키 생성하기' 버튼 표시
      domainLoadingMessage.textContent = 'API 키를 먼저 생성해 주세요.';
    }

  } catch (error) {
    console.error("고객 데이터 로드 오류:", error);
    apiKeyLoadingMessage.textContent = error.message;
    domainLoadingMessage.textContent = error.message;
  }
}

/**
 * (v0.4) 도메인 배열을 받아 화면에 목록(UI)을 그립니다.
 */
function renderDomainList(domains = []) {
  domainList.innerHTML = ''; // 목록 비우기
  if (domains.length === 0) {
    domainList.innerHTML = '<p>아직 등록된 도메인이 없습니다.</p>';
    return;
  }

  domains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <span>${domain}</span>
      <button class="delete-domain-btn" data-domain="${domain}">X</button>
    `;
    domainList.appendChild(item);
  });
}

// dashboard.js (파일 맨 마지막에 이어서 추가)

// --- 8. (v0.4) 도메인 '쓰기' (추가/삭제) 기능 ---

/**
 * (v0.4) 현재 도메인 목록과 새 도메인을 받아,
 * 'update-domains' Supabase 함수를 호출하여 DB를 업데이트합니다.
 */
async function updateDomainsInDatabase(newDomainsList) {
  domainMessage.textContent = '도메인 목록 저장 중...';
  domainMessage.className = 'success-message';
  
  try {
    // 1. (보안) 현재 로그인한 사용자의 '인증 토큰' 가져오기
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    const userToken = session.access_token;

    // 2. 'update-domains' Supabase 함수를 호출합니다.
    const { data, error: funcError } = await supabaseClient.functions.invoke(
      'update-domains', // [!!!] 우리가 배포한 함수의 이름
      {
        headers: { 'Authorization': `Bearer ${userToken}` },
        body: { newDomains: newDomainsList } // [!!!] 새 도메인 목록을 body에 담아 전송
      }
    );

    if (funcError) throw new Error(`함수 호출 실패: ${funcError.message}`);
    if (data.error) throw new Error(`도메인 업데이트 실패: ${data.error}`);

    // 3. 성공! 함수가 반환한 최종 목록으로 UI를 다시 그립니다.
    domainMessage.textContent = data.message;
    renderDomainList(data.updatedDomains); // UI 새로고침

  } catch (error) {
    console.error('도메인 업데이트 오류:', error);
    domainMessage.textContent = error.message;
    domainMessage.className = 'error-message';
  }
}

/**
 * (v0.4) '도메인 추가' 폼 제출 이벤트 리스너
 */
domainForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // 폼 새로고침 방지
  const newDomain = domainInput.value.trim();
  if (!newDomain) return;

  // 1. 현재 UI에 있는 도메인 목록 가져오기
  let currentDomains = [];
  document.querySelectorAll('.domain-item span').forEach(item => {
    currentDomains.push(item.textContent);
  });

  // 2. 새 도메인 추가 (중복 방지)
  if (currentDomains.includes(newDomain)) {
    domainMessage.textContent = '이미 등록된 도메인입니다.';
    domainMessage.className = 'error-message';
    return;
  }
  currentDomains.push(newDomain);

  // 3. DB 업데이트 함수 호출
  await updateDomainsInDatabase(currentDomains);
  domainInput.value = ''; // 입력창 비우기
});

/**
 * (v0.4) '도메인 삭제' 버튼 클릭 이벤트 리스너 (이벤트 위임)
 */
domainList.addEventListener('click', async (e) => {
  // 'X' 버튼 (class="delete-domain-btn")을 클릭했을 때만 작동
  if (e.target.classList.contains('delete-domain-btn')) {
    const domainToDelete = e.target.dataset.domain;
    
    // 1. 현재 UI에서 삭제할 도메인을 *제외*한 새 목록 생성
    let currentDomains = [];
    document.querySelectorAll('.domain-item span').forEach(item => {
      if (item.textContent !== domainToDelete) {
        currentDomains.push(item.textContent);
      }
    });

    // 2. DB 업데이트 함수 호출
    await updateDomainsInDatabase(currentDomains);
  }
});