# Genspark 기능 참고용 정리 파일

이 zip은 Claude에 업로드하기 위해 원본 genspark-main.zip에서 필요한 기능 파일만 추린 것입니다.

## 목적
- 최종 UI/디자인은 Claude가 만든 디자인을 유지합니다.
- 이 파일은 Genspark 미수금 프로그램의 기능/로직 참고용입니다.
- 통째로 덮어쓰기하지 말고 필요한 기능만 분석해서 이식합니다.

## 포함
- frontend/: React/Vite 프론트 소스
- backend/: FastAPI 백엔드 소스, 라우터, 모델, 스키마, 엑셀 업로드/수납/대시보드/통장매칭 로직
- README/Dockerfile/docker-compose 등 참고 파일

## 제외
- node_modules
- .git
- dist/build
- backend/app/static 빌드 결과물
- __pycache__
- DESKTOP-H7DMKQR 백업 중복 파일
- 실제 .env 파일

## Claude에게 요청할 내용
디자인은 Claude 디자인 그대로 유지하고, 이 Genspark 파일에서 아래 기능만 가져와서 통합하세요.
- 미수금 명단 조회
- 회원/차량번호 검색
- 지역별 미수금 필터
- 협회비/관리비/70세 구분
- 0원/선납/미납 필터
- 회원 상세
- 수납 처리 모달
- 수납 후 잔액 자동 계산
- 수납 내역 저장
- 엑셀 업로드 미리보기
- 엑셀 다운로드
- 통장 입금내역/수납 매칭
- 대시보드 집계 기준 통일

주의: 기존 데이터 삭제 금지, 업로드 전 미리보기 필수, 0원/선납자도 명단에서 빠지지 않게 처리.
