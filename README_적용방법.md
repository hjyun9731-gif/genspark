# misugeum 회원용 미수금 조회 사이트 패치

## 추가되는 화면

- 회원 조회: `/member-arrears`
- 관리자 공개자료 관리: `/admin/public-arrears`

회원 조회 조건은 다음 3개입니다.

```text
차량번호 + 성명 + 휴대폰 뒤 4자리
```

회원 화면에는 주소, 주민등록번호, 전체 전화번호, 전체 명단, 엑셀 다운로드가 나오지 않습니다.

---

## 적용 방법

실제 `misugeum` 프로젝트 폴더에 이 패치 폴더 내용을 복사한 뒤, 프로젝트 루트에서 실행합니다.

```bash
python patch_member_lookup.py
python -m py_compile main.py routers/public_lookup.py
```

그다음 로컬 또는 Railway에서 확인합니다.

```text
/member-arrears
/admin/public-arrears
```

---

## Railway 환경변수 추가

Railway Variables에 아래 값을 추가하세요.

```text
PUBLIC_ARREARS_ADMIN_KEY=관리자만 아는 비밀번호
PUBLIC_ARREARS_BANK_ACCOUNT=농협 XXXX-XX-XXXXXX 강원도개인소형화물협회
```

`PUBLIC_ARREARS_ADMIN_KEY`가 없으면 관리자 업로드/DB갱신 기능은 작동하지 않습니다.

---

## 관리자 사용 순서

1. `/admin/public-arrears` 접속
2. 관리자 키 입력
3. 먼저 **DB에서 공개조회용 데이터 생성** 버튼 시도
4. 자동 생성이 안 되면 엑셀/CSV 업로드 사용
5. 회원에게 `/member-arrears` 링크 문자 발송

---

## 업로드 파일 조건

엑셀 또는 CSV에 최소 컬럼이 있어야 합니다.

```text
차량번호
성명
휴대폰 또는 핸드폰 또는 전화번호
미수금 또는 현재잔액
```

`2026미수금` 파일처럼 `1월 미수금`, `2월 미수금`, `3월 미수금`이 여러 개 있으면 **마지막으로 값이 있는 미수금 컬럼**을 현재 미수금액으로 사용합니다.

휴대폰 뒤 4자리가 없는 행은 보안상 공개조회용 데이터에서 제외됩니다.

---

## 문자 예시

```text
[강원도개인소형화물협회]
협회비·관리비 미수금 조회는 아래 링크에서 가능합니다.

https://배포주소/member-arrears

차량번호, 성명, 휴대폰 뒤 4자리를 입력 후 확인해 주세요.
문의: 033-254-3221
```

---

## 되돌리기

패치 전 `main.py`는 자동으로 아래 파일에 백업됩니다.

```text
main.py.before_member_lookup_patch
```

되돌리려면:

```bash
copy main.py.before_member_lookup_patch main.py
```

또는 mac/linux:

```bash
cp main.py.before_member_lookup_patch main.py
```
