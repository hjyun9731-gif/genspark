using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace AutoCertPrint
{
    public class MainForm : Form
    {
        private TextBox txtAdminNo, txtName, txtCertNo, txtYear, txtMonth, txtDay, txtCarNo;
        private Button btnDirectPrint, btnOpenAndPrint;
        private string templatePath;

        public MainForm()
        {
            InitializeComponent();
            templatePath = Path.Combine(Application.StartupPath, "template.hwp");
        }

        private void InitializeComponent()
        {
            this.Text = "자격증명 자동인쇄 - AutoCertPrint";
            this.Size = new Size(400, 450);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;

            int labelX = 20, inputX = 150, startY = 20, spacing = 40;

            AddLabelAndTextBox("관리번호:", ref txtAdminNo, labelX, startY, "21-462");
            AddLabelAndTextBox("성명:", ref txtName, labelX, startY += spacing, "이지효");
            AddLabelAndTextBox("자격증번호:", ref txtCertNo, labelX, startY += spacing, "1-21-042414");
            AddLabelAndTextBox("발급연도:", ref txtYear, labelX, startY += spacing, "2026");
            AddLabelAndTextBox("발급월:", ref txtMonth, labelX, startY += spacing, "06");
            AddLabelAndTextBox("발급일:", ref txtDay, labelX, startY += spacing, "17");
            AddLabelAndTextBox("차량번호:", ref txtCarNo, labelX, startY += spacing, "강원83배1166");

            btnDirectPrint = new Button { Text = "바로 인쇄", Location = new Point(50, 350), Size = new Size(130, 40) };
            btnDirectPrint.Click += (s, e) => ProcessHwp(true);

            btnOpenAndPrint = new Button { Text = "한글에서 확인 후 인쇄", Location = new Point(200, 350), Size = new Size(150, 40) };
            btnOpenAndPrint.Click += (s, e) => ProcessHwp(false);

            this.Controls.Add(btnDirectPrint);
            this.Controls.Add(btnOpenAndPrint);
        }

        private void AddLabelAndTextBox(string labelText, ref TextBox textBox, int x, int y, string defaultValue)
        {
            Label lbl = new Label { Text = labelText, Location = new Point(x, y), AutoSize = true };
            textBox = new TextBox { Text = defaultValue, Location = new Point(150, y), Width = 200 };
            this.Controls.Add(lbl);
            this.Controls.Add(textBox);
        }

        private void ProcessHwp(bool directPrint)
        {
            if (!File.Exists(templatePath))
            {
                MessageBox.Show("template.hwp 파일을 찾을 수 없습니다.", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string tempDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AutoCertPrint", "temp");
            if (!Directory.Exists(tempDir)) Directory.CreateDirectory(tempDir);
            
            string tempFile = Path.Combine(tempDir, $"temp_{DateTime.Now:yyyyMMddHHmmss}.hwp");
            File.Copy(templatePath, tempFile, true);

            dynamic hwp = null;
            try
            {
                Type hwpType = Type.GetTypeFromProgID("HwpFrame.HwpObject");
                if (hwpType == null)
                {
                    MessageBox.Show("한컴오피스 한글이 설치되어 있어야 합니다.", "오류", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                hwp = Activator.CreateInstance(hwpType);
                hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule"); // 보안 승인 모듈 (필요시)

                if (hwp.Open(tempFile, "HWP", ""))
                {
                    // 차량번호 자동 띄어쓰기 처리
                    string carNo = txtCarNo.Text.Trim();
                    if (carNo.Length > 4 && !carNo.Contains(" "))
                    {
                        // 예: 강원83배1166 -> 강원83배 1166
                        carNo = carNo.Substring(0, carNo.Length - 4) + " " + carNo.Substring(carNo.Length - 4);
                    }

                    // 치환 작업 (기존 샘플값을 찾아서 변경)
                    ReplaceText(hwp, "21-462", txtAdminNo.Text);
                    ReplaceText(hwp, "26-247", txtAdminNo.Text);
                    
                    ReplaceText(hwp, "이지효", txtName.Text);
                    ReplaceText(hwp, "이 지 효", txtName.Text);
                    ReplaceText(hwp, "홍영기", txtName.Text);
                    ReplaceText(hwp, "홍 영 기", txtName.Text);

                    ReplaceText(hwp, "1-21-042414", txtCertNo.Text);
                    ReplaceText(hwp, "1-13-094294", txtCertNo.Text);

                    ReplaceText(hwp, "2026", txtYear.Text);
                    
                    ReplaceText(hwp, "06", txtMonth.Text);
                    ReplaceText(hwp, "6", txtMonth.Text);

                    ReplaceText(hwp, "17", txtDay.Text);
                    ReplaceText(hwp, "22", txtDay.Text);

                    ReplaceText(hwp, "강원83배1166", carNo);
                    ReplaceText(hwp, "강원83배 1166", carNo);
                    ReplaceText(hwp, "강원87자2819", carNo);

                    hwp.Save();

                    if (directPrint)
                    {
                        hwp.HAction.GetDefault("Print", hwp.HParameterSet.HPrint.HSet);
                        hwp.HAction.Execute("Print", hwp.HParameterSet.HPrint.HSet);
                        hwp.Quit();
                        File.Delete(tempFile);
                        MessageBox.Show("인쇄 명령을 보냈습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        hwp.ShowWindow(true);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("작업 중 오류가 발생했습니다: " + ex.Message, "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                if (hwp != null) hwp.Quit();
            }
        }

        private void ReplaceText(dynamic hwp, string oldText, string newText)
        {
            dynamic act = hwp.HAction;
            dynamic set = hwp.HParameterSet.HFindReplace;
            hwp.HAction.GetDefault("AllReplace", set.HSet);
            set.FindString = oldText;
            set.ReplaceString = newText;
            set.IgnoreReplaceCase = 1;
            set.AllSearch = 1;
            act.Execute("AllReplace", set.HSet);
        }
    }
}
