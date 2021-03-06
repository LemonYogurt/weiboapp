var valitor = new Valitor();
function Valitor() {}
// 添加点击事件
Valitor.prototype.addClickEvent = function () {
    var self = this;
    // 选项卡切换
    $('#J_register').click(function(e) {
        $(e.target).addClass('active');
        $('#J_login').removeClass('active');
        $('#J_formLogin').hide();
        $('#J_formLogin input').val('');
        $('#J_formRegister').show();
    });
    $('#J_login').click(function(e) {
        $(e.target).addClass('active');
        $('#J_register').removeClass('active');
        $('#J_formRegister').hide();
        $('#J_formRegister input').val('');
        $('#J_formLogin').show();
    });
    // 登录和注册按钮
    $('#J_loginBtn').click(function () {
        // 验证用户名和密码
        var username = $.trim($('#loginName').val());
        var password = $.trim($('#loginPassword').val());
        var regName = /^[a-zA-Z\u4e00-\u9fa5]+$/;
        if (!username) {
            window.printMsg('warning', 'userEmpty');
            return false;
        } else if (!password) {
            window.printMsg('warning', 'pwdEmpty')
            return false;
        }
        if (!regName.test(username)) {
            window.printMsg('warning', 'userError');
            return false;
        } else if (password.length < 6){
            window.printMsg('warning', 'pwdError');
            return false;
        }

        // 发送数据
        var fd = new FormData();
        fd.append('username', username);
        fd.append('password', password);

        self.sendData('/user/login', fd, $('#J_register'), 'login');
    });

    $('#J_registerBtn').click(function () {
        // 验证用户名和密码
        var username = $.trim($('#registerName').val());
        var password = $.trim($('#registerPassword').val());
        var regName = /^[a-zA-Z\u4e00-\u9fa5]+$/;
        if (!username) {
            window.printMsg('warning', 'userEmpty');
            return false;
        } else if (!password) {
            window.printMsg('warning', 'pwdEmpty')
            return false;
        }
        if (!regName.test(username)) {
            window.printMsg('warning', 'userError');
            return false;
        } else if (password.length < 6){
            window.printMsg('warning', 'pwdError');
            return false;
        }
        // 发送数据
        var fd = new FormData();
        fd.append('username', username);
        fd.append('password', password);
        self.sendData('/user/register', fd, $('#J_login'), 'register');
    });
};

Valitor.prototype.sendData = function (url, data, elem, operType) {
    $.ajax({
        url: url,
        type: 'POST',
        data: data,
        processData: false, // 告诉jQuery不要去处理发送的数据
        contentType: false, // 告诉jQuery不要去设置Content-Type请求头
        beforeSend: function (xhr) {
            elem.attr('disabled', 'disabled');
        },
        success: function (data) {
            window.printMsg('success', data.msg, true);
            window.location.href = 'http://' + window.location.host + '/';
        },
        error: function (data) {
            window.printMsg('error', JSON.parse(data.responseText).msg, true);
            elem.attr('disabled', '');
        }
    });
};

Valitor.prototype.addBlurEvent = function () {
    var self = this;
    $('#registerName').blur(self.valitName);
    $('#loginName').blur(self.valitName);

    $('#registerPassword').blur(self.valitPassword);
    $('#loginPassword').blur(self.valitPassword);
};

Valitor.prototype.valitName = function (e) {
    var regName = /^[a-zA-Z\u4e00-\u9fa5]+$/;
    var value = $.trim($(e.target).val());
    if (!value) {
        window.printMsg('warning', 'userEmpty');
    } else if (!regName.test(value)) {
        window.printMsg('warning', 'userError');
    }
};
Valitor.prototype.valitPassword = function (e) {
    var value = $.trim($(e.target).val());
    if (value.length < 6) {
        window.printMsg('warning', 'pwdError');
    }
};

valitor.addClickEvent();
valitor.addBlurEvent();