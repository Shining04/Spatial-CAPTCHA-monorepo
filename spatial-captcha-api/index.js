// ===================================================================
// Spatial-CAPTCHA API (v1.0) - 최종본
// ===================================================================

// --- 1. 라이브러리 임포트 ---
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const THREE = require('three');
const { Pool } = require('pg'); // DB(Supabase) 드라이버

// --- 2. 앱 및 상수 설정 ---
const app = express();
const port = process.env.PORT || 3000;
const FREE_TIER_QUOTA = 1000; // 'free' 플랜의 월간 한도

// --- 3. 환경 변수 및 DB 연결 ---
const MASTER_API_KEY_UNUSED = process.env.MASTER_API_KEY; // (v1.0에선 사용 안함)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[치명적 오류] : DATABASE_URL 환경 변수가 설정되지 않았습니다!");
}

// DB 커넥션 풀 생성
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// --- 4. CORS 및 미들웨어 설정 ---
// (v1.0 수정) 모든 출처의 '사전 요청(Preflight)'을 허용합니다.
// (실제 보안 검사는 'DB 문지기'가 담당합니다.)
app.use(cors());
app.use(express.json());
app.options('/api/v1/create', cors());
app.options('/api/v1/verify', cors());

// --- 5. 임시 세션 저장소 ---
const sessionStore = {};

// --- 6. 헬퍼 함수 (각도 계산) ---
function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// ===================================================================
// 7. [핵심] DB 문지기 (v1.0 - 한도 검사 버전)
// ===================================================================
// /api/v1/ 로 시작하는 모든 요청은 이 '문지기'를 먼저 통과해야 합니다.
app.use('/api/v1', async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    const origin = req.header('Origin'); // 요청이 시작된 사이트 주소

    if (!apiKey) {
      return res.status(401).json({ message: "인증 실패: API 키가 누락되었습니다." });
    }

    // 1. DB에서 고객 정보 조회
    const query = "SELECT * FROM customers WHERE api_key = $1";
    const result = await pool.query(query, [apiKey]);

    if (result.rows.length === 0) {
      console.warn(`[DB 인증 실패] 등록되지 않은 API 키: ${apiKey}`);
      return res.status(401).json({ message: "인증 실패: 유효하지 않은 API 키입니다." });
    }

    const customer = result.rows[0];

    // 2. 도메인 검사 (배열에 포함되어 있는지)
    if (!customer.allowed_domain || !customer.allowed_domain.includes(origin)) {
      console.warn(`[DB 인증 실패] 허용되지 않은 도메인: ${origin} (허용 목록: [${customer.allowed_domain}])`);
      return res.status(401).json({ message: "인증 실패: 허용되지 않은 도메인입니다." });
    }

    // 3. 사용량 한도(Quota) 검사
    if (customer.plan === 'free' && customer.usage_count >= FREE_TIER_QUOTA) {
      console.warn(`[한도 초과] 'free' 플랜 고객(${apiKey.slice(-4)})이 한도(${FREE_TIER_QUOTA})를 초과했습니다.`);
      return res.status(429).json({ message: "사용량 한도 초과: 'Pro' 플랜으로 업그레이드하세요." });
    }

    // 4. 모든 인증 통과!
    // 다음 단계(/create)에서 사용하도록 'req' 객체에 고객 정보(API 키)를 실어 보냅니다.
    req.customer_api_key = customer.api_key;
    next();

  } catch (error) {
    console.error("[DB 문지기 오류]", error);
    res.status(500).json({ message: "서버 내부 오류 (DB Auth)" });
  }
});

// ===================================================================
// 8. 캡챠 챌린지 생성 API (v1.0 - 사용량 카운트 버전)
// ===================================================================
app.post('/api/v1/create', async (req, res) => {
  // '문지기'가 통과시킨 고객 API 키를 받습니다.
  const customerApiKey = req.customer_api_key; 
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // 트랜잭션 시작

    // 1. DB에서 랜덤 모델 1개 가져오기
    const modelQuery = "SELECT model_url FROM models ORDER BY RANDOM() LIMIT 1";
    const modelResult = await client.query(modelQuery);

    if (modelResult.rows.length === 0) {
      throw new Error("DB에 등록된 3D 모델이 없습니다.");
    }
    const selectedModelUrl = modelResult.rows[0].model_url;

    // 2. 세션 ID 생성
    const sessionId = uuidv4();

    // 3. [NaN 오류 수정] 무작위 정답 각도 생성
    const targetRotation = {
      x: degToRad(randFloat(-90, 90)),
      y: degToRad(randFloat(-90, 90)),
      z: degToRad(randFloat(-45, 45))
    };

    // 4. 임시 저장소에 정답 저장
    sessionStore[sessionId] = targetRotation;

    // 5. 고객 사용량(usage_count) +1 업데이트
    const updateUsageQuery = "UPDATE customers SET usage_count = usage_count + 1 WHERE api_key = $1";
    await client.query(updateUsageQuery, [customerApiKey]);

    // 6. DB 작업 확정
    await client.query('COMMIT'); 
    
    // 7. 클라이언트에 챌린지 정보 전송
    res.status(201).json({ 
      session_id: sessionId,
      target_rotation: targetRotation, // '각도'가 포함된 객체
      model_url: selectedModelUrl
    });

    console.log(`[v1.0 챌린지 생성] 모델: ${selectedModelUrl}, 고객: ${customerApiKey.slice(-4)}`);

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error("[Create API 오류]", error);
    res.status(500).json({ message: "서버 내부 오류 (Create)" });
  } finally {
    client.release(); 
  }
});

// ===================================================================
// 9. 캡챠 검증 API (v0.2 - 변경 없음)
// ===================================================================
app.post('/api/v1/verify', (req, res) => {
  try {
    const { session_id, user_rotation } = req.body;

    if (!session_id || !sessionStore[session_id]) {
      return res.status(400).json({ message: "유효하지 않은 세션입니다." });
    }

    const targetRotation = sessionStore[session_id];

    // ... (Three.js 각도 비교 로직) ...
    const userQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(user_rotation.x, user_rotation.y, user_rotation.z)
    );
    const targetQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(targetRotation.x, targetRotation.y, targetRotation.z)
    );
    const angleRadians = userQuaternion.angleTo(targetQuaternion);
    const angleDegrees = THREE.MathUtils.radToDeg(angleRadians);
    
    const toleranceDegrees = 35; 

    if (angleDegrees < toleranceDegrees) {
      // 성공
      console.log(`[${session_id}] 검증 성공! (오차: ${angleDegrees.toFixed(1)}°)`);
      res.json({
        verified: true,
        error_angle: angleDegrees,
        tolerance: toleranceDegrees
      });
      delete sessionStore[session_id]; // 성공 시 세션 삭제
    } else {
      // 실패
      console.log(`[${session_id}] 검증 실패. (오차: ${angleDegrees.toFixed(1)}°)`);
      res.json({
        verified: false,
        error_angle: angleDegrees,
        tolerance: toleranceDegrees
      });
    }

  } catch (error) {
    console.error("Verify API 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

// ===================================================================
// 10. 서버 실행
// ===================================================================
app.listen(port, () => {
  console.log(`🚀 Spatial-CAPTCHA API 서버가 (v1.0) http://localhost:${port} 에서 실행 중입니다.`);
});