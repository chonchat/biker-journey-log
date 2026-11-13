# 🏍️ คู่มือการเปิดและ Build แอปมือถือ Android (RideMap) ด้วย Capacitor

โปรเจกต์นี้ได้รับการติดตั้ง **Capacitor** และสร้างโครงสร้างโปรเจกต์ **Native Android** พร้อมใช้งานเรียบร้อยแล้ว!

---

## 🛠️ 1. สิ่งที่ต้องมีในเครื่องคอมพิวเตอร์
1. **Android Studio** (ดาวน์โหลดฟรีได้ที่: https://developer.android.com/studio)
2. **Node.js** (มีในเครื่องของคุณเรียบร้อยแล้ว)

---

## 🚀 2. ขั้นตอนการเปิดโปรเจกต์ขึ้น Android Studio
เปิด Terminal หรือ PowerShell ที่โฟลเดอร์โปรเจกต์นี้ แล้วพิมพ์คำสั่ง:

```bash
npm run cap:open:android
```
*(คำสั่งนี้จะเปิดโปรแกรม Android Studio และโหลดโปรเจกต์ Android ของคุณขึ้นมาโดยอัตโนมัติ)*

หรือจะเปิดโปรแกรม **Android Studio** เอง แล้วเลือก **Open** -> ไปที่โฟลเดอร์:
`c:\Users\Lenovo\Desktop\Biker_Journey_Log\android`

---

## 📦 3. วิธีการสร้างไฟล์ APK เพื่อนำไปติดตั้งในโทรศัพท์มือถือ

เมื่อ Android Studio โหลดและ Sync Gradle เสร็จสิ้น:

1. ไปที่เมนูด้านบน: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**
2. รอโปรแกรม Build สักครู่ (ประมาณ 1-2 นาที)
3. เมื่อเสร็จแล้วจะมีข้อความแจ้งเตือนที่มุมขวาล่างว่า **"Build APK(s): APK(s) generated successfully."**
4. คลิกที่คำว่า **`locate`** จะเปิดโฟลเดอร์ที่เก็บไฟล์ `app-debug.apk` ทันที!
5. ส่งไฟล์ `app-debug.apk` เข้าโทรศัพท์มือถือของคุณ (ผ่าน Line, Google Drive หรือเสียบสาย USB) แล้วกดติดตั้งและใช้งานได้ทันที 📱✨

---

## 🔄 4. เมื่อแก้ไขโค้ด HTML / CSS / JS แล้วต้องการอัปเดตลงในแอปมือถือ

หากมีการปรับแต่งหน้าตาเว็บหรือแก้ไขโค้ด ให้รันคำสั่งนี้เพียงคำสั่งเดียว:

```bash
npm run cap:sync
```
ระบบจะทำการรวมโค้ดและซิงค์เข้าไปในโปรเจกต์ Android ให้อัตโนมัติทันที

---

## ⚙️ ข้อมูลการตั้งค่าโปรเจกต์
* **Package Name (App ID):** `com.bikerjourney.ridemap`
* **App Name:** `RideMap`
* **Android SDK Min:** 22 (รองรับ Android 5.1 ขึ้นไปจนถึง Android 14+)
* **Permissions:** รองรับ GPS ความแม่นยำสูง (`ACCESS_FINE_LOCATION`), อินเทอร์เน็ต (`INTERNET`) และการเข้าถึงรูปภาพ (`READ_MEDIA_IMAGES`)
