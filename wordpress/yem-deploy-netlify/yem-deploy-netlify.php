<?php
/**
 * Plugin Name: Yenamarre.sn — Déploiement automatique
 * Description: Pour le site Y'EN A MARRE uniquement (yenamarre.sn). Relance automatiquement la mise à jour du site public sur Netlify quand un contenu est modifié dans WordPress. À activer seulement sur le site yenamarre du réseau, pas sur tout le réseau.
 * Version: 1.1.0
 * Author: Y'EN A MARRE
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

const YEM_DEPLOY_OPTION_URL    = 'yem_deploy_hook_url';
const YEM_DEPLOY_OPTION_LAST   = 'yem_deploy_last';
const YEM_DEPLOY_LOCK          = 'yem_deploy_lock';
const YEM_DEPLOY_CRON          = 'yem_deploy_cron';
const YEM_DEPLOY_DELAI         = 60; // secondes entre deux builds

/** Types de contenu lus par le site Astro. */
function yem_deploy_types() {
    return apply_filters('yem_deploy_types', [
        'post', 'page', 'projet', 'membre', 'bureau', 'faq', 'timeline_event', 'wp_navigation', 'attachment',
    ]);
}

/**
 * Déclenche le build Netlify. Si un build vient d'être lancé, regroupe les
 * modifications : un seul build est planifié à la fin du délai.
 */
function yem_deploy_trigger($raison = 'Modification WordPress') {
    $url = trim((string) get_option(YEM_DEPLOY_OPTION_URL, ''));
    if ($url === '') {
        return false;
    }
    if (get_transient(YEM_DEPLOY_LOCK)) {
        if (!wp_next_scheduled(YEM_DEPLOY_CRON)) {
            wp_schedule_single_event(time() + YEM_DEPLOY_DELAI + 5, YEM_DEPLOY_CRON);
        }
        return false;
    }
    set_transient(YEM_DEPLOY_LOCK, 1, YEM_DEPLOY_DELAI);
    $cible = add_query_arg('trigger_title', rawurlencode('WordPress : ' . wp_strip_all_tags($raison)), $url);
    wp_remote_post($cible, ['blocking' => false, 'timeout' => 5, 'body' => '{}']);
    update_option(YEM_DEPLOY_OPTION_LAST, ['date' => current_time('mysql'), 'raison' => $raison], false);
    return true;
}

add_action(YEM_DEPLOY_CRON, function () {
    delete_transient(YEM_DEPLOY_LOCK);
    yem_deploy_trigger('Modifications groupées');
});

/** Contenu publié (ou retiré de la publication) d'un type suivi. */
function yem_deploy_post_concerne($post_id, $avant_publie = false) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return false;
    }
    $post = get_post($post_id);
    if (!$post || !in_array($post->post_type, yem_deploy_types(), true)) {
        return false;
    }
    return in_array($post->post_status, ['publish', 'inherit'], true) || $avant_publie;
}

add_action('wp_after_insert_post', function ($post_id, $post, $update, $post_before) {
    $avant = $post_before && $post_before->post_status === 'publish';
    if (yem_deploy_post_concerne($post_id, $avant)) {
        yem_deploy_trigger(get_the_title($post_id));
    }
}, 20, 4);

// Champs ACF enregistrés (dans l'éditeur de blocs, ils arrivent dans une 2e requête).
add_action('acf/save_post', function ($post_id) {
    if (is_numeric($post_id) && yem_deploy_post_concerne((int) $post_id)) {
        yem_deploy_trigger(get_the_title((int) $post_id) . ' (champs)');
    }
}, 20);

add_action('trashed_post', function ($post_id) {
    $post = get_post($post_id);
    if ($post && in_array($post->post_type, yem_deploy_types(), true)) {
        yem_deploy_trigger('Mise à la corbeille : ' . get_the_title($post_id));
    }
});

foreach (['created_term', 'edited_term', 'delete_term'] as $hook) {
    add_action($hook, function () {
        yem_deploy_trigger('Catégories / étiquettes');
    });
}

/* ---------- Réglages › Déploiement du site ---------- */

add_action('admin_menu', function () {
    add_options_page('Déploiement yenamarre.sn', 'Déploiement yenamarre.sn', 'manage_options', 'yem-deploy', 'yem_deploy_page');
});

add_action('admin_init', function () {
    register_setting('yem_deploy', YEM_DEPLOY_OPTION_URL, [
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => false,
    ]);
});

function yem_deploy_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $last = get_option(YEM_DEPLOY_OPTION_LAST);
    ?>
    <div class="wrap">
        <h1>Déploiement de yenamarre.sn</h1>
        <p>Chaque modification de contenu de ce site WordPress relance la mise à jour de <strong>yenamarre.sn</strong> (délai d'environ 2 minutes). Les modifications rapprochées sont regroupées.</p>
        <form method="post" action="options.php">
            <?php settings_fields('yem_deploy'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="yem_deploy_hook_url">URL du build hook Netlify</label></th>
                    <td>
                        <input type="url" class="large-text code" id="yem_deploy_hook_url" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_URL); ?>" value="<?php echo esc_attr(get_option(YEM_DEPLOY_OPTION_URL, '')); ?>" placeholder="https://api.netlify.com/build_hooks/…">
                        <p class="description">Netlify › Site configuration › Build &amp; deploy › Build hooks.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>
        <hr>
        <p><strong>Dernier déclenchement :</strong>
            <?php echo $last ? esc_html($last['date'] . ' — ' . $last['raison']) : 'aucun'; ?></p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="yem_deploy_now">
            <?php wp_nonce_field('yem_deploy_now'); ?>
            <?php submit_button('Publier yenamarre.sn maintenant', 'secondary'); ?>
        </form>
    </div>
    <?php
}

/* ---------- Bouton manuel (page de réglages + barre d'admin) ---------- */

add_action('admin_post_yem_deploy_now', function () {
    if (!current_user_can('edit_pages') || !check_admin_referer('yem_deploy_now')) {
        wp_die('Action non autorisée.');
    }
    delete_transient(YEM_DEPLOY_LOCK);
    $ok = yem_deploy_trigger('Publication manuelle');
    $retour = wp_get_referer() ?: admin_url();
    wp_safe_redirect(add_query_arg('yem_deploy', $ok ? 'ok' : 'erreur', $retour));
    exit;
});

add_action('admin_bar_menu', function ($bar) {
    if (!current_user_can('edit_pages') || get_option(YEM_DEPLOY_OPTION_URL, '') === '') {
        return;
    }
    $url = wp_nonce_url(admin_url('admin-post.php?action=yem_deploy_now'), 'yem_deploy_now');
    $bar->add_node(['id' => 'yem-deploy', 'title' => '🚀 Publier yenamarre.sn', 'href' => $url]);
}, 100);

add_action('admin_notices', function () {
    if (!isset($_GET['yem_deploy'])) {
        return;
    }
    $ok = $_GET['yem_deploy'] === 'ok';
    printf(
        '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
        $ok ? 'success' : 'error',
        $ok ? 'Mise à jour de yenamarre.sn lancée : visible dans environ 2 minutes.' : 'Impossible de lancer la mise à jour : vérifiez l’URL du build hook (Réglages › Déploiement yenamarre.sn).'
    );
});
