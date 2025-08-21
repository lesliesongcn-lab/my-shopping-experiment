// 通用表单验证逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 为所有必填字段添加实时验证
  const requiredFields = document.querySelectorAll('[required]');
  
  requiredFields.forEach(field => {
    field.addEventListener('input', () => {
      validateField(field);
    });
  });
});

function validateField(field) {
  if (field.checkValidity()) {
    field.style.borderColor = '#2ecc71';
  } else {
    field.style.borderColor = '#e74c3c';
  }
}