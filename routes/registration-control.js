const express = require('express');
const router = express.Router();
const { ControleRegistro } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.tipo_conta !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado. Apenas administradores podem gerenciar o controle de registro.'
        });
    }
    next();
};

// GET - Obter status atual do controle de registro
router.get('/status', async (req, res) => {
    try {
        // Buscar configuração mais recente
        const control = await ControleRegistro.findOne({
            order: [['updated_at', 'DESC']]
        });

        if (!control) {
            // Se não há configuração, criar uma padrão
            const defaultControl = await ControleRegistro.create({
                registration_enabled: true,
                admin_message: 'Neste momento não estamos a receber novos parceiros! Entre em contacto com administrador para mais informações.',
                admin_email: 'sistema@ratixpay.com',
                admin_contact: '+258842363948'
            });

            return res.json({
                success: true,
                data: {
                    registration_enabled: defaultControl.registration_enabled,
                    scheduled_start: defaultControl.scheduled_start,
                    scheduled_end: defaultControl.scheduled_end,
                    admin_message: defaultControl.admin_message,
                    admin_email: defaultControl.admin_email,
                    admin_contact: defaultControl.admin_contact,
                    last_updated: defaultControl.updated_at
                }
            });
        }

        // Verificar se há agendamento que deve ser executado
        const now = new Date();
        let needsUpdate = false;
        let updatedControl = { ...control.dataValues };

        // Verificar se deve habilitar registro automaticamente
        if (!control.registration_enabled && control.scheduled_start && now >= new Date(control.scheduled_start)) {
            updatedControl.registration_enabled = true;
            updatedControl.scheduled_start = null;
            needsUpdate = true;
        }

        // Verificar se deve desabilitar registro automaticamente
        if (control.registration_enabled && control.scheduled_end && now >= new Date(control.scheduled_end)) {
            updatedControl.registration_enabled = false;
            updatedControl.scheduled_end = null;
            needsUpdate = true;
        }

        // Atualizar se necessário
        if (needsUpdate) {
            await ControleRegistro.update(updatedControl, {
                where: { id: control.id }
            });
        }

        res.json({
            success: true,
            data: {
                registration_enabled: updatedControl.registration_enabled,
                scheduled_start: updatedControl.scheduled_start,
                scheduled_end: updatedControl.scheduled_end,
                admin_message: updatedControl.admin_message,
                admin_email: updatedControl.admin_email,
                admin_contact: updatedControl.admin_contact,
                last_updated: updatedControl.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao obter status do controle de registro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// PUT - Atualizar configurações de controle de registro (apenas admin)
router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { 
            registration_enabled, 
            scheduled_start, 
            scheduled_end, 
            admin_message, 
            admin_email, 
            admin_contact 
        } = req.body;

        // Validar dados
        if (typeof registration_enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'registration_enabled deve ser um valor booleano'
            });
        }

        if (scheduled_start && isNaN(Date.parse(scheduled_start))) {
            return res.status(400).json({
                success: false,
                error: 'scheduled_start deve ser uma data válida'
            });
        }

        if (scheduled_end && isNaN(Date.parse(scheduled_end))) {
            return res.status(400).json({
                success: false,
                error: 'scheduled_end deve ser uma data válida'
            });
        }

        if (scheduled_start && scheduled_end && new Date(scheduled_start) >= new Date(scheduled_end)) {
            return res.status(400).json({
                success: false,
                error: 'scheduled_start deve ser anterior a scheduled_end'
            });
        }

        // Buscar configuração atual
        let control = await ControleRegistro.findOne({
            order: [['updated_at', 'DESC']]
        });

        const updateData = {
            registration_enabled,
            scheduled_start: scheduled_start ? new Date(scheduled_start) : null,
            scheduled_end: scheduled_end ? new Date(scheduled_end) : null,
            admin_message: admin_message || 'Neste momento não estamos a receber novos parceiros! Entre em contacto com administrador para mais informações.',
            admin_email: admin_email || 'ratixpay.mz@gmail.com',
            admin_contact: admin_contact || '+258842363948',
            updated_by: req.user.id
        };

        if (control) {
            // Atualizar configuração existente
            await ControleRegistro.update(updateData, {
                where: { id: control.id }
            });
        } else {
            // Criar nova configuração
            updateData.created_by = req.user.id;
            control = await ControleRegistro.create(updateData);
        }

        // Buscar configuração atualizada
        const updatedControl = await ControleRegistro.findOne({
            order: [['updated_at', 'DESC']]
        });

        res.json({
            success: true,
            message: 'Configurações de controle de registro atualizadas com sucesso',
            data: {
                registration_enabled: updatedControl.registration_enabled,
                scheduled_start: updatedControl.scheduled_start,
                scheduled_end: updatedControl.scheduled_end,
                admin_message: updatedControl.admin_message,
                admin_email: updatedControl.admin_email,
                admin_contact: updatedControl.admin_contact,
                last_updated: updatedControl.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar controle de registro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Alternar status de registro (apenas admin)
router.post('/toggle', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Buscar configuração atual
        let control = await ControleRegistro.findOne({
            order: [['updated_at', 'DESC']]
        });

        if (!control) {
            // Criar configuração padrão se não existir
            control = await ControleRegistro.create({
                registration_enabled: true,
                admin_message: 'Neste momento não estamos a receber novos parceiros! Entre em contacto com administrador para mais informações.',
                admin_email: 'sistema@ratixpay.com',
                admin_contact: '+258842363948',
                created_by: req.user.id
            });
        }

        // Alternar status
        const newStatus = !control.registration_enabled;
        
        await ControleRegistro.update({
            registration_enabled: newStatus,
            scheduled_start: null, // Limpar agendamentos ao alternar manualmente
            scheduled_end: null,
            updated_by: req.user.id
        }, {
            where: { id: control.id }
        });

        // Buscar configuração atualizada
        const updatedControl = await ControleRegistro.findOne({
            order: [['updated_at', 'DESC']]
        });

        res.json({
            success: true,
            message: `Registro ${newStatus ? 'habilitado' : 'desabilitado'} com sucesso`,
            data: {
                registration_enabled: updatedControl.registration_enabled,
                scheduled_start: updatedControl.scheduled_start,
                scheduled_end: updatedControl.scheduled_end,
                admin_message: updatedControl.admin_message,
                admin_email: updatedControl.admin_email,
                admin_contact: updatedControl.admin_contact,
                last_updated: updatedControl.updated_at
            }
        });

    } catch (error) {
        console.error('Erro ao alternar status de registro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET - Histórico de alterações (apenas admin)
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const history = await ControleRegistro.findAndCountAll({
            order: [['updated_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: require('../config/database').Usuario,
                    as: 'CreatedBy',
                    attributes: ['id', 'nome', 'nome_completo'],
                    required: false
                },
                {
                    model: require('../config/database').Usuario,
                    as: 'UpdatedBy',
                    attributes: ['id', 'nome', 'nome_completo'],
                    required: false
                }
            ]
        });

        res.json({
            success: true,
            data: {
                records: history.rows,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(history.count / limit),
                    total_records: history.count,
                    records_per_page: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Erro ao obter histórico de controle de registro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
